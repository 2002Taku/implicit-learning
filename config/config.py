# config/config.py

import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your_secret_key_here'
    REDIS_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'
    # 必要に応じて他の設定を追加
