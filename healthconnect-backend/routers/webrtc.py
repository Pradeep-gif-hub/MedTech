from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.sender: Optional[WebSocket] = None
        self.receiver: Optional[WebSocket] = None
        # pending messages when the counterpart hasn't connected yet
        self.pending_for_receiver: list[str] = []
        self.pending_for_sender: list[str] = []

    async def connect(self, websocket: WebSocket, role: str):
        await websocket.accept()
        if role == 'sender':
            self.sender = websocket
            # flush any messages that arrived for sender while it was disconnected
            if self.pending_for_sender:
                for msg in self.pending_for_sender:
                    try:
                        await websocket.send_text(msg)
                    except Exception:
                        pass
                self.pending_for_sender.clear()
        elif role == 'receiver':
            self.receiver = websocket
            # flush any messages that arrived for receiver while it was disconnected
            if self.pending_for_receiver:
                for msg in self.pending_for_receiver:
                    try:
                        await websocket.send_text(msg)
                    except Exception:
                        pass
                self.pending_for_receiver.clear()

    def disconnect(self, websocket: WebSocket):
        if websocket == self.sender:
            self.sender = None
        elif websocket == self.receiver:
            self.receiver = None

    async def relay(self, sender_ws: WebSocket, data: str):
        # Relay messages between sender and receiver
        if sender_ws == self.sender:
            if self.receiver:
                await self.receiver.send_text(data)
            else:
                # queue for receiver until they connect
                self.pending_for_receiver.append(data)
        elif sender_ws == self.receiver:
            if self.sender:
                await self.sender.send_text(data)
            else:
                # queue for sender until they connect
                self.pending_for_sender.append(data)

manager = ConnectionManager()

@router.websocket("/ws/live-consultation/{role}")
async def websocket_endpoint(websocket: WebSocket, role: str):
    await manager.connect(websocket, role)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.relay(websocket, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)