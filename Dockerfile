FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOST=0.0.0.0 PORT=4173 WORDQUEST_DATA_DIR=/data
WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock && useradd --create-home app && mkdir /data && chown app:app /data
COPY --chown=app:app . .
USER app
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4173/health')"
CMD ["gunicorn", "--bind", "0.0.0.0:4173", "--workers", "1", "--threads", "4", "--timeout", "120", "app:app"]
