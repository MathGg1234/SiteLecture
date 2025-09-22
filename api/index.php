<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Auth');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }
require __DIR__ . '/config.php';
function read_data() {
  if (!file_exists(DATA_FILE)) {
    return ['schemaVersion'=>1,'updatedAt'=>gmdate('c'),'items'=>[]];
  }
  $raw = file_get_contents(DATA_FILE);
  $json = json_decode($raw, true);
  return $json ?: ['schemaVersion'=>1,'updatedAt'=>gmdate('c'),'items'=>[]];
}
function write_data($data) {
  $data['updatedAt'] = gmdate('c');
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  $fp = fopen(DATA_FILE, 'c+');
  if (!$fp) { http_response_code(500); echo json_encode(['error'=>'Cannot open data file']); exit; }
  flock($fp, LOCK_EX); ftruncate($fp,0); fwrite($fp,$json); fflush($fp); flock($fp,LOCK_UN); fclose($fp);
}
if ($_SERVER['REQUEST_METHOD'] === 'GET') { echo json_encode(read_data(), JSON_UNESCAPED_UNICODE); exit; }
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_auth();
  $body = json_decode(file_get_contents('php://input'), true) ?? [];
  $action = $body['action'] ?? '';
  $data = read_data();
  $items = $data['items'] ?? [];
  $findIndex = function($id) use ($items) { foreach ($items as $i=>$it){ if (($it['id']??null)===$id) return $i; } return -1; };
  if ($action === 'upsert') {
    $item = $body['item'] ?? null;
    if (!$item || !isset($item['id'])) { http_response_code(400); echo json_encode(['error'=>'Missing item or id']); exit; }
    $idx = $findIndex($item['id']);
    if ($idx >= 0) {
      $existing = $items[$idx];
      $prev = $existing['progress'] ?? null;
      $newp = $item['progress'] ?? $prev;
      if ($prev !== $newp) { $item['lastReadAt'] = $item['lastReadAt'] ?? gmdate('c'); }
      $items[$idx] = array_replace_recursive($existing, $item);
    } else {
      $item['lastReadAt'] = $item['lastReadAt'] ?? gmdate('c');
      $items[] = $item;
    }
    $data['items'] = array_values($items);
    write_data($data);
    echo json_encode(['ok'=>true,'updatedAt'=>$data['updatedAt']]); exit;
  }
  if ($action === 'delete') {
    $id = $body['id'] ?? '';
    $items = array_values(array_filter($items, fn($it)=>($it['id']??'')!==$id));
    $data['items'] = $items; write_data($data);
    echo json_encode(['ok'=>true,'updatedAt'=>$data['updatedAt']]); exit;
  }
  if ($action === 'bulkReplace') {
    $list = $body['items'] ?? [];
    if (!is_array($list)) { http_response_code(400); echo json_encode(['error'=>'items must be array']); exit; }
    $data['items'] = $list; write_data($data);
    echo json_encode(['ok'=>true,'updatedAt'=>$data['updatedAt']]); exit;
  }
  http_response_code(400); echo json_encode(['error'=>'Unknown action']); exit;
}
http_response_code(405); echo json_encode(['error'=>'Method not allowed']);
