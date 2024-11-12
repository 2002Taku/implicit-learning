#!/bin/bash
# このスクリプトはRQワーカーを起動します。
cd /Users/kasetakuma/flask
# 仮想環境のアクティベート
source /Users/kasetakuma/flask/venv/bin/activate

# RQワーカーの起動
rq worker default
