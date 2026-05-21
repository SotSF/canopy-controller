import asyncio
import websockets

async def handler(websocket, path):
    connection_open = True
    print("Connection opened")
    while connection_open:
        try:
            data = await websocket.recv()
            print("> Received {}".format(data))
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed")
            connection_open = False

start_server = websockets.serve(handler, '0.0.0.0', 9431)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
