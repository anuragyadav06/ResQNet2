"""
ResQNet System A - Command & Intelligence Platform
FastAPI Application Entry Point
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.routes import api_router
from app.websocket.connection_manager import connection_manager
from app.websocket.protocol import MessageType
from app.schemas.telemetry import DroneTelemetryPacket, ObservationPacket
from app.schemas.command import CommandAck, CommandResult
from app.state.world_state import world_state
from app.audit.audit_logger import audit_logger
from app.intelligence.perception.perception_agent import perception_agent
from app.intelligence.incidents.incident_agent import incident_agent
from app.simulation.digital_twin_runner import digital_twin_runner

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("resqnet.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing ResQNet System A Command Platform...")
    await audit_logger.initialize()
    broadcast_task = asyncio.create_task(connection_manager.start_periodic_broadcast(interval_s=0.2))
    # Start digital twin runner for autonomous execution
    digital_twin_runner.start()
    logger.info("ResQNet System A is fully OPERATIONAL.")
    yield
    # Shutdown
    logger.info("Shutting down ResQNet System A...")
    digital_twin_runner.stop()
    broadcast_task.cancel()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


# ============================================================================
# WEBSOCKET ENDPOINTS
# ============================================================================

@app.websocket("/ws/frontend")
async def websocket_frontend_endpoint(websocket: WebSocket):
    """Operator Command Center WebSocket stream."""
    await connection_manager.connect_frontend(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Frontend can send client heartbeats or query requests
            msg = json.loads(data)
            if msg.get("type") == "PING":
                await websocket.send_text(json.dumps({"type": "PONG", "timestamp": msg.get("timestamp")}))
    except WebSocketDisconnect:
        await connection_manager.disconnect_frontend(websocket)
    except Exception as e:
        logger.error(f"Frontend WS error: {e}")
        await connection_manager.disconnect_frontend(websocket)


@app.websocket("/ws/simulation/{session_id}")
async def websocket_simulation_endpoint(websocket: WebSocket, session_id: str):
    """System B (Godot Digital Twin) Bidirectional WebSocket stream."""
    await connection_manager.connect_simulation(session_id, websocket)
    try:
        while True:
            text = await websocket.receive_text()
            data = json.loads(text)
            msg_type = data.get("type")

            if msg_type == MessageType.TELEMETRY_BATCH.value:
                for pkt_dict in data.get("packets", []):
                    pkt = DroneTelemetryPacket(**pkt_dict)
                    world_state.update_drone_telemetry(pkt)

            elif msg_type == MessageType.OBSERVATION.value:
                obs_dict = data.get("observation", {})
                obs = ObservationPacket(**obs_dict)
                validated_obs = perception_agent.process_observation(obs)
                if validated_obs:
                    await incident_agent.process_observation(validated_obs)

            elif msg_type == MessageType.COMMAND_ACK.value:
                ack = CommandAck(**data.get("ack", {}))
                await connection_manager.handle_command_ack(ack)

            elif msg_type == MessageType.COMMAND_RESULT.value:
                res = CommandResult(**data.get("result", {}))
                # Mark command complete in world state
                logger.info(f"Received command result: {res.command_id} - {res.status}")

            elif msg_type == MessageType.HEARTBEAT.value:
                await websocket.send_text(json.dumps({
                    "type": MessageType.HEARTBEAT_ACK.value,
                    "server_time": world_state.simulation_time,
                }))

    except WebSocketDisconnect:
        await connection_manager.disconnect_simulation(session_id)
    except Exception as e:
        logger.error(f"Simulation WS error for {session_id}: {e}")
        await connection_manager.disconnect_simulation(session_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
