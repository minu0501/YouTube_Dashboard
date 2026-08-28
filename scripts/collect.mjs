#!/usr/bin/env node
/**
 * YouTube 채널 일일 수집기
 *
 *  · channels.json 에 등록된 채널의 구독자 / 총조회수 / 영상수를 하루 한 줄씩 기록
 *  · 업로드된 영상 목록을 수집해 잔디 히트맵·월간 차트 데이터를 만든다
 *
 * 실행:
 *   YOUTUBE_API_KEY=... node scripts/collect.mjs                → 등록된 전 채널 수집
 *   YOUTUBE_API_KEY=... node scripts/collect.mjs "@핸들"         → 채널 추가 후 수집
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT   = path.resolve(import.meta.dirname, '..');
const KEY    = process.env.YOUTUBE_API_KEY;
const PALETTE = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e'];
const MAX_VIDEO_PAGES = 40;   // 채널당 최대 2000개 영상

if (!KEY) {
  console.error('❌ YOUTUBE_API_KEY 가 없습니다. GitHub Secrets 에 등록했는지 확인하세요.');
  process.exit(1);
}

const CHANNELS_FILE  = path.join(ROOT, 'channels.json');
const SNAPSHOTS_FILE = path.join(ROOT, 'data', 'snapshots.json');
const VIDEOS_FILE    = path.join(ROOT, 'data', 'videos.json');
const STATUS_FILE    = path.join(ROOT, 'data', 'status.json');

let quotaUsed = 0;

// ── YouTube API 호출 ────────────────────────────────
async function yt(endpoint, params, cost = 1) {
  const url = new URL('https://www.googleapis.com/youtube/v3/' + endpoint);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', KEY);

  const res  = await fetch(url);
  const body = await res.json().catch(() => ({}));
  quotaUsed += cost;

  if (!res.ok) {
    const msg = body?.error?.message || res.statusText;
    throw new Error(`YouTube API ${endpoint} 실패 (${res.status}): ${msg}`);
  }
  return body;
}

// ── 파일 헬퍼 ───────────────────────────────────────
async function readJSON(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function writeJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
function kstToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

// ── 입력값 → 채널 ID 해석 ───────────────────────────
// 지원: UC로 시작하는 채널ID / 채널 URL / @핸들 / 예전 c·user 주소
async function resolveChannelId(input) {
  const raw = String(input).trim();

  if (/^UC[\w-]{22}$/.test(raw)) return raw;

  let id = null, handle = null, username = null;

  const m = raw.match(/youtube\.com\/(?:channel\/(UC[\w-]{22})|@([\w.\-]+)|c\/([\w.\-]+)|user\/([\w.\-]+))/i);
  if (m) {
    id       = m[1] || null;
    handle   = m[2] || m[3] || null;
    username = m[4] || null;
  } else if (raw.startsWith('@')) {
    handle = raw.slice(1);
  } else {
    handle = raw.replace(/^\/+/, '');
  }

  if (id) return id;

  if (handle) {
    const r = await yt('channels', { part: 'id', forHandle: '@' + handle });
    if (r.items?.length) return r.items[0].id;
  }

  const legacy = username || handle;
  if (legacy) {
    const r = await yt('channels', { part: 'id', forUsername: legacy });
    if (r.items?.length) return r.items[0].id;
  }

  // 최후의 수단 — 검색은 100 유닛이라 되도록 안 타게 위에서 다 걸러낸다
  const s = await yt('search', { part: 'snippet', type: 'channel', maxResults: '1', q: handle || username || raw }, 100);
  const found = s.items?.[0]?.id?.channelId || s.items?.[0]?.snippet?.channelId;
  if (found) return found;

  throw new Error(`채널을 찾을 수 없습니다: ${raw}`);
}

// ── 채널 정보 + 통계 ────────────────────────────────
async function fetchChannel(id) {
  const r = await yt('channels', { part: 'snippet,statistics,contentDetails', id });
  const c = r.items?.[0];
  if (!c) throw new Error(`채널 정보를 가져오지 못했습니다: ${id}`);

  const thumbs = c.snippet.thumbnails || {};
  return {
    id,
    title:     c.snippet.title,
    thumbnail: (thumbs.medium || thumbs.default || {}).url || '',
    uploads:   c.contentDetails?.relatedPlaylists?.uploads || null,
    stats: {
      subscribers: Number(c.statistics.subscriberCount || 0),
      views:       Number(c.statistics.viewCount || 0),
      videoCount:  Number(c.statistics.videoCount || 0),
    },
    hiddenSubs: c.statistics.hiddenSubscriberCount === true,
  };
}

// ── 업로드 영상 전체 목록 ───────────────────────────
async function fetchVideos(uploadsPlaylistId) {
  if (!uploadsPlaylistId) return [];

  const videos = [];
  let pageToken = '';

  for (let page = 0; page < MAX_VIDEO_PAGES; page++) {
    const params = { part: 'contentDetails,snippet', playlistId: uploadsPlaylistId, maxResults: '50' };
    if (pageToken) params.pageToken = pageToken;

    const r = await yt('playlistItems', params);

    for (const item of r.items || []) {
      const videoId = item.contentDetails?.videoId;
      // playlistItem 의 snippet.publishedAt 은 "재생목록에 담긴 시각"이라 실제 공개일과 다르다
      const publishedAt = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt;
      if (!videoId || !publishedAt) continue;
      videos.push({ id: videoId, title: item.snippet?.title || '', publishedAt });
    }

    pageToken = r.nextPageToken || '';
    if (!pageToken) break;
  }

  videos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return videos;
}

// ── 메인 ────────────────────────────────────────────
async function main() {
  const addInput = process.env.CHANNEL_INPUT || process.argv[2];
  const addColor = process.env.CHANNEL_COLOR || '';

  const config    = await readJSON(CHANNELS_FILE, { channels: [] });
  const snapshots = await readJSON(SNAPSHOTS_FILE, {});
  const videosDb  = await readJSON(VIDEOS_FILE, {});

  config.channels ||= [];

  // ── 채널 추가 모드 ──
  if (addInput && addInput.trim()) {
    console.log(`🔍 채널 확인 중: ${addInput}`);
    const id = await resolveChannelId(addInput);

    if (config.channels.some(c => c.id === id)) {
      console.log(`ℹ️  이미 등록된 채널입니다 (${id}) — 수집만 진행합니다.`);
    } else {
      config.channels.push({
        id,
        color: addColor || PALETTE[config.channels.length % PALETTE.length],
        addedAt: kstToday(),
      });
      console.log(`✅ 채널 등록: ${id}`);
    }
  }

  if (config.channels.length === 0) {
    console.log('⚠️  등록된 채널이 없습니다. "채널 추가" 워크플로를 먼저 실행하세요.');
    await writeJSON(STATUS_FILE, { lastRun: new Date().toISOString(), channels: 0, quotaUsed, errors: [] });
    return;
  }

  const today  = kstToday();
  const errors = [];

  for (const ch of config.channels) {
    try {
      const info = await fetchChannel(ch.id);

      // channels.json 에 이름·썸네일을 되써서 대시보드가 그대로 쓰게 한다
      ch.name      = info.title;
      ch.thumbnail = info.thumbnail;
      ch.color   ||= PALETTE[config.channels.indexOf(ch) % PALETTE.length];

      // 오늘자 스냅샷 (같은 날 여러 번 돌면 덮어쓴다)
      snapshots[ch.id] ||= {};
      snapshots[ch.id][today] = {
        subscribers: info.stats.subscribers,
        views:       info.stats.views,
        videoCount:  info.stats.videoCount,
      };

      const videos = await fetchVideos(info.uploads);
      if (videos.length > 0) videosDb[ch.id] = videos;

      const subNote = info.hiddenSubs ? ' (구독자 비공개)' : '';
      console.log(`📊 ${info.title}: 구독자 ${info.stats.subscribers.toLocaleString()}${subNote} / 조회수 ${info.stats.views.toLocaleString()} / 영상 ${videos.length}개`);
    } catch (e) {
      console.error(`❌ ${ch.id}: ${e.message}`);
      errors.push({ channelId: ch.id, message: e.message });
    }
  }

  // 등록 해제된 채널의 묵은 데이터 정리
  const alive = new Set(config.channels.map(c => c.id));
  for (const id of Object.keys(snapshots)) if (!alive.has(id)) delete snapshots[id];
  for (const id of Object.keys(videosDb))  if (!alive.has(id)) delete videosDb[id];

  await writeJSON(CHANNELS_FILE, config);
  await writeJSON(SNAPSHOTS_FILE, snapshots);
  await writeJSON(VIDEOS_FILE, videosDb);
  await writeJSON(STATUS_FILE, {
    lastRun:  new Date().toISOString(),
    lastDate: today,
    channels: config.channels.length,
    quotaUsed,
    errors,
  });

  console.log(`\n✨ 완료 — ${today} 기준, 채널 ${config.channels.length}개, 사용 쿼터 ${quotaUsed} / 10000 유닛`);

  // 채널 하나도 못 읽었으면 워크플로를 실패로 표시해 알림이 가게 한다
  if (errors.length === config.channels.length) process.exit(1);
}

main().catch(e => { console.error('💥 ' + e.message); process.exit(1); });
