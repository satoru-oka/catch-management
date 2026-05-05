from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import spots, sessions, catches, lures

app = FastAPI(title="釣果管理アプリ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(spots.router)
app.include_router(sessions.router)
app.include_router(catches.router)
app.include_router(lures.router)


@app.get("/")
def root():
    return {"message": "釣果管理アプリ API 起動中"}
