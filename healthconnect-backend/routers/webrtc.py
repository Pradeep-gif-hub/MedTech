import json
from dataclasses import dataclass, field
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


def _normalize_role(role: str) -> str:
    role_value = (role or "").strip().lower()
    if role_value in {"sender", "patient"}:
        return "patient"
    return "doctor"


@dataclass
class RoomState:
    patient: WebSocket | None = None
    doctor: WebSocket | None = None
    pending_for_patient: list[str] = field(default_factory=list)
    pending_for_doctor: list[str] = field(default_factory=list)


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, RoomState] = {}

    def _get_room(self, room_id: str) -> RoomState:
        if room_id not in self.rooms:
            self.rooms[room_id] = RoomState()
        return self.rooms[room_id]

    async def connect(self, websocket: WebSocket, role: str, room_id: str):
        await websocket.accept()
        room = self._get_room(room_id)

        if role == "patient":
            room.patient = websocket
            if room.pending_for_patient:
                for payload in room.pending_for_patient:
                    try:
                        await websocket.send_text(payload)
                    except Exception:
                        pass
                room.pending_for_patient.clear()
        else:
            room.doctor = websocket
            if room.pending_for_doctor:
                for payload in room.pending_for_doctor:
                    try:
                        await websocket.send_text(payload)
                    except Exception:
                        pass
                room.pending_for_doctor.clear()

    def disconnect(self, role: str, room_id: str):
        room = self.rooms.get(room_id)
        if not room:
            return

        if role == "patient":
            room.patient = None
        else:
            room.doctor = None

        if room.patient is None and room.doctor is None and not room.pending_for_patient and not room.pending_for_doctor:
            self.rooms.pop(room_id, None)

    async def relay(self, room_id: str, sender_role: str, payload: str):
        room = self._get_room(room_id)

        if sender_role == "patient":
            if room.doctor:
                await room.doctor.send_text(payload)
            else:
                room.pending_for_doctor.append(payload)
        else:
            if room.patient:
                await room.patient.send_text(payload)
            else:
                room.pending_for_patient.append(payload)


manager = ConnectionManager()


@router.websocket("/ws/live-consultation/{role}")
async def websocket_endpoint(websocket: WebSocket, role: str):
    room_id = (
        websocket.query_params.get("roomId")
        or websocket.query_params.get("room_id")
        or "global-room"
    )
    normalized_role = _normalize_role(role)

    print(f"[WEBRTC] connect role={normalized_role} room={room_id}")
    await manager.connect(websocket, normalized_role, room_id)

    try:
        while True:
            raw_data = await websocket.receive_text()

            try:
                payload = json.loads(raw_data)
            except Exception:
                # Legacy passthrough payload support.
                await manager.relay(room_id, normalized_role, raw_data)
                continue

            event_type = (payload.get("type") or "").strip().lower()

            if event_type == "join-room":
                # Keep join-room event for frontend signaling flow visibility.
                await websocket.send_text(json.dumps({
                    "type": "joined",
                    "roomId": room_id,
                    "role": normalized_role,
                }))
                continue

            if event_type == "ice":
                payload["type"] = "ice-candidate"

            if event_type in {"offer", "answer", "ice", "ice-candidate"}:
                await manager.relay(room_id, normalized_role, json.dumps(payload))
            else:
                # Relay unknown JSON messages too (non-breaking behavior)
                await manager.relay(room_id, normalized_role, json.dumps(payload))
    except WebSocketDisconnect:
        print(f"[WEBRTC] disconnect role={normalized_role} room={room_id}")
        manager.disconnect(normalized_role, room_id)