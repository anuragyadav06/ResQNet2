extends Node3D

# ResQNet System B - 3D Physical Drone Controller
class_name DroneController

@export var drone_id: String = "DRONE-S01"
@export var max_speed: float = 12.0
@export var cruise_altitude: float = 15.0

var waypoints: Array = []
var current_wp_idx: int = 0
var current_command_id: String = ""
var status: String = "IDLE"
var battery_percent: float = 100.0
var velocity: Vector3 = Vector3.ZERO
var heading_deg: float = 0.0

@onready var client = $"../../ResQNetClient"

func _ready():
	print("[Drone ", drone_id, "] Initialized at position: ", global_position)

func assign_waypoints(cmd_id: String, new_wps: Array):
	current_command_id = cmd_id
	waypoints = new_wps
	current_wp_idx = 0
	status = "EN_ROUTE"
	print("[Drone ", drone_id, "] Assigned ", waypoints.size(), " waypoints for command ", cmd_id)

func _physics_process(delta: float):
	if status == "EN_ROUTE" and waypoints.size() > 0:
		if current_wp_idx >= waypoints.size():
			status = "ON_SITE"
			velocity = Vector3.ZERO
			print("[Drone ", drone_id, "] Completed all waypoints for command ", current_command_id)
			if client:
				client.send_command_result(current_command_id, drone_id, true, "Waypoints completed successfully")
			return

		var wp = waypoints[current_wp_idx]
		var wp_pos_dict = wp.get("position", {})
		var target_pos = Vector3(
			wp_pos_dict.get("x", 0.0),
			wp_pos_dict.get("y", cruise_altitude),
			wp_pos_dict.get("z", 0.0)
		)

		var diff = target_pos - global_position
		var dist = diff.length()
		var step = max_speed * delta

		if dist <= step or dist < 0.5:
			global_position = target_pos
			current_wp_idx += 1
		else:
			var dir = diff.normalized()
			velocity = dir * max_speed
			global_position += velocity * delta
			
			# Yaw heading
			heading_deg = rad_to_deg(atan2(dir.x, dir.z))
			rotation_degrees.y = heading_deg

		# Realistic battery discharge
		battery_percent = max(0.0, battery_percent - (delta * 0.04))

func get_telemetry_data() -> Dictionary:
	return {
		"drone_id": drone_id,
		"timestamp": Time.get_ticks_msec() / 1000.0,
		"position": {
			"x": global_position.x,
			"y": global_position.y,
			"z": global_position.z
		},
		"velocity": {
			"x": velocity.x,
			"y": velocity.y,
			"z": velocity.z
		},
		"heading": heading_deg,
		"battery_percent": battery_percent,
		"battery_voltage": 24.0,
		"current_draw_a": 15.2,
		"altitude_agl_m": global_position.y,
		"communication_quality": 0.98,
		"status": status,
		"current_waypoint_index": current_wp_idx
	}
