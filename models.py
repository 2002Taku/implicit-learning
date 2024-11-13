# models.py

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(UserMixin):
    def __init__(self, id, username, password, is_admin=False):
        self.id = id
        self.username = username
        self.password_hash = generate_password_hash(password)
        self.is_admin = is_admin
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)