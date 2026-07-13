<?php
/* =========================================================
   submit.php - Production Ready with Safe Headers (FIXED)
========================================================= */

/* ---------- CONFIG: EDIT YOUR ADMIN EMAIL ---------- */
const ADMIN_EMAIL   = 'oubo@my-teams.co.jp'; // <-- 1. MAKE SURE THIS IS YOUR EXACT BUSINESS/RECEIVING EMAIL!
const SITE_NAME     = '寮寮ワーク';
const FROM_ADDRESS  = 'no-reply@ryoryo-work.com';       // <-- Authenticated XServer domain address
/* ------------------------------------------------------ */

header('Content-Type: application/json; charset=utf-8');

// Ensure PHP multibyte internal channels handle Japanese characters safely
mb_language("Japanese");
mb_internal_encoding("UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid data']);
    exit;
}

function clean($v) {
    return trim(strip_tags((string)($v ?? '')));
}

$name          = clean($data['name'] ?? '');
$email         = filter_var(clean($data['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$phone         = clean($data['phone'] ?? '');
$phoneStopped  = clean($data['phoneStopped'] ?? '');
$prefecture    = clean($data['prefecture'] ?? '');
$gender        = clean($data['gender'] ?? '');
$birthday      = clean($data['birthday'] ?? '');
$step1         = clean($data['step1_寮希望'] ?? '');
$step2         = clean($data['step2_悩み'] ?? '');
$step3         = clean($data['step3_時期'] ?? '');
$submittedAt   = clean($data['submitted_at'] ?? date('Y-m-d H:i:s'));

if ($name === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Name is required']);
    exit;
}
if (!$email && $phone === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Email or phone is required']);
    exit;
}

/* ---------- Helper: build safe UTF-8 headers ---------- */
function buildHeaders(?string $replyTo = null): string {
    $headers   = [];
    $headers[] = "MIME-Version: 1.0";
    $headers[] = "Content-Type: text/plain; charset=UTF-8";
    // THIS is the key fix: without declaring the transfer encoding,
    // many mail servers assume 7-bit ASCII and mangle multi-byte
    // UTF-8 (Japanese) characters into "?".
    $headers[] = "Content-Transfer-Encoding: 8bit";
    $headers[] = "From: " . mb_encode_mimeheader(SITE_NAME, "UTF-8") . " <" . FROM_ADDRESS . ">";
    if ($replyTo) {
        $headers[] = "Reply-To: {$replyTo}";
    }
    // Use RFC-correct \r\n line endings, not \n
    return implode("\r\n", $headers);
}

/* ---------- 1. Admin Notification Email ---------- */
// FIXED: Subject is plain UTF-8. mb_send_mail will encode this perfectly.
$adminSubject = "【" . SITE_NAME . "】新規応募：" . $name . " 様";

$adminBody = "新しい応募がありました。\n\n"
    . "お名前： {$name}\n"
    . "メール： " . ($email ?: '（未入力）') . "\n"
    . "電話番号： " . ($phone ?: '（未入力）') . "\n"
    . "携帯電話停止中： {$phoneStopped}\n"
    . "都道府県： {$prefecture}\n"
    . "性別： {$gender}\n"
    . "生年月日： {$birthday}\n"
    . "寮希望： {$step1}\n"
    . "お悩み： {$step2}\n"
    . "勤務開始希望： {$step3}\n"
    . "送信日時： {$submittedAt}\n";

$adminHeaders = buildHeaders($email ?: null);

// Deliver alert to company inbox (Owner notification)
$adminSent = mb_send_mail(ADMIN_EMAIL, $adminSubject, $adminBody, $adminHeaders, "-f" . FROM_ADDRESS);

/* ---------- 2. Applicant Auto-Reply Email ---------- */
$applicantSent = true;
if ($email) {
    // FIXED: Subject is plain UTF-8. mb_send_mail will encode this perfectly.
    $applicantSubject = "【" . SITE_NAME . "】ご応募ありがとうございます";

    $applicantBody = "{$name} 様\n\n"
        . "この度は、" . SITE_NAME . "へご応募いただきありがとうございます。\n"
        . "担当者より1時間以内を目安にご連絡いたしますので、しばらくお待ちください。\n\n"
        . "お急ぎの場合は下記お電話またはLINEよりご連絡ください。\n"
        . "電話：06-6940-0370\n"
        . "LINE：https://l-tra.com/ad/LTRYiU9Ai8\n\n"
        . "――――――――――――――\n"
        . SITE_NAME . "\n";

    $applicantHeaders = buildHeaders();

    $applicantSent = mb_send_mail($email, $applicantSubject, $applicantBody, $applicantHeaders, "-f" . FROM_ADDRESS);
}

/* ---------- 3. Return Response to Frontend ---------- */
if ($adminSent) {
    echo json_encode([
        'success' => true,
        'message' => 'Owner notification sent successfully.'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Mail server rejected admin notification'
    ]);
}