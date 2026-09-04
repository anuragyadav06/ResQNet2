extends Node

# ResQNet System B - Godot 4 WebSocket Digital Twin Client
class_name ResQNetClient

@export var websocket_url: String = "ws://127.0.0.1:8000/ws/simulation/metro_godot_01"
@export var telemetry_frequency_hz: float = 10.0

var socket: WebSocketPeer = WebSocketPeer.new()
var is_connected_to_system_a: bool = false
var telemetry_timer: float = 0.0
var session_id: String = "metro_godot_01"

# Reference to city and drones in the scene
@onready var drones_root = $"../Drones"
@onready var city_root = $"../CityGrid"

func _ready():
	print("[ResQNet System B] Connecting to System A at ", websocket_url)
	connect_to_server()

func connect_to_server():
	var err = socket.connect_to_url(websocket_url)
	if err != OK:
		print("[ResQNet System B] Socket connection error: ", err)

func _process(delta: float):
	socket.poll()
	var state = socket.get_ready_state()

	if state == WebSocketPeer.STATE_OPEN:
		if not is_connected_to_system_a:
			is_connected_to_system_a = true
			print("[ResQNet System B] Connected to System A! Sending registration handshake...")
			send_registration()
		
		# Ingest incoming packets from System A
		while socket.get_available_packet_count() > 0:
			var packet = socket.get_packet()
			var msg_str = packet.get_string_from_utf8()
			_handle_message(msg_str)

		# Send 10Hz telemetry
		telemetry_timer += delta
		if telemetry_timer >= (1.0 / telemetry_frequency_hz):
			telemetry_timer = 0.0
			send_telemetry_batch()

	elif state == WebSocketPeer.STATE_CLOSED:
		if is_connected_to_system_a:
			is_connected_to_system_a = false
			print("[ResQNet System B] Disconnected from System A. Retrying in 2s...")
		telemetry_timer += delta
		if telemetry_timer >= 2.0:
			telemetry_timer = 0.0
			connect_to_server()

func send_registration():
	var msg = {
		"type": "REGISTER_SIMULATION",
		"session_id": session_id,
		"client_version": "Godot_4.7_Physics",
		"environment_name": "Metro City Digital Twin 3D",
		"grid_bounds": {"min_x": -200, "max_x": 200, "min_z": -200, "max_z": 200}
	}
	_send_json(msg)

func send_telemetry_batch():
	var packets = []
	if drones_root:
		for drone_node in drones_root.get_children():
			if drone_node.has_method("get_telemetry_data"):
				packets.append(drone_node.get_telemetry_data())

	var batch = {
		"type": "TELEMETRY_BATCH",
		"session_id": session_id,
		"timestamp": Time.get_ticks_msec() / 1000.0,
		"packets": packets
	}
	_send_json(batch)

func send_command_ack(cmd_id: String, drone_id: String, status_str: String = "ACCEPTED"):
	var ack = {
		"type": "COMMAND_ACK",
		"ack": {
			"command_id": cmd_id,
			"drone_id": drone_id,
			"status": status_str,
			"timestamp": Time.get_ticks_msec() / 1000.0
		}
	}
	_send_json(ack)

func send_command_result(cmd_id: String, drone_id: String, success: bool, details: String = ""):
	var res = {
		"type": "COMMAND_RESULT",
		"result": {
			"command_id": cmd_id,
			"drone_id": drone_id,
			"status": "SUCCESS" if success else "FAILED",
			"details": details,
			"timestamp": Time.get_ticks_msec() / 1000.0
		}
	}
	_send_json(res)

func _handle_message(msg_str: String):
	var json = JSON.new()
	var parse_err = json.parse(msg_str)
	if parse_err != OK:
		print("[ResQNet System B] Failed to parse message JSON: ", msg_str)
		return

	var data = json.data
	var msg_type = data.get("type", "")

	if msg_type == "COMMAND":
		var cmd = data.get("command", {})
		_execute_command(cmd)

func _execute_command(cmd: Dictionary):
	var cmd_id = cmd.get("command_id", "")
	var drone_id = cmd.get("drone_id", "")
	var waypoints = cmd.get("waypoints", [])
	
	print("[ResQNet System B] Received command ", cmd_id, " for drone ", drone_id)
	
	# Send ACK
	send_command_ack(cmd_id, drone_id, "ACCEPTED")

	# Find matching drone in 3D scene
	var drone_node = null
	if drones_root:
		drone_node = drones_root.get_node_or_null(drone_id)

	if drone_node and drone_node.has_method("assign_waypoints"):
		drone_node.assign_waypoints(cmd_id, waypoints)
	else:
		print("[ResQNet System B] Drone node not found: ", drone_id)

func _send_json(data: Dictionary):
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		var json_str = JSON.stringify(data)
		socket.send_text(json_str)
