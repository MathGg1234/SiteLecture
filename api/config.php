<?php
const SECRET_TOKEN = 'change-me-very-long-random-token-64chars-min';
const DATA_FILE = __DIR__ . '/data.json';
function require_auth() {
  $token = $_SERVER['HTTP_X_AUTH'] ?? '';
  if ($token !== SECRET_TOKEN) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
  }
}
