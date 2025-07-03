from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI()

# static 폴더 설정
app.mount("/static", StaticFiles(directory="static"), name="static")

# favicon.ico 엔드포인트 추가
@app.get('/favicon.ico', include_in_schema=False)
async def favicon():
    return FileResponse('static/favicon.ico')