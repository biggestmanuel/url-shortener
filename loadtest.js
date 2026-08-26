import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

const listDuration = new Trend('link_list_duration');
const createDuration = new Trend('link_create_duration');
const redirectDuration = new Trend('link_redirect_duration');
const deleteDuration = new Trend('link_delete_duration');
const operationErrors = new Rate('operation_errors');

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '10s', target: 100 },
    { duration: '10s', target: 250 },
    { duration: '10s', target: 500 },
    { duration: '10s', target: 1000 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    link_list_duration: ['p(95)<1000'],
    link_create_duration: ['p(95)<1000'],
    link_redirect_duration: ['p(95)<1000'],
    link_delete_duration: ['p(95)<1000'],
    operation_errors: ['rate<0.01'],
  },
};

export default function () {
  let res = http.get(`${BASE_URL}/api/links?limit=50`, {
    tags: { name: 'GET /api/links' },
  });

  listDuration.add(res.timings.duration);

  const listOk = check(res, {
    'LIST: status 200': (r) => r.status === 200,
    'LIST: valid JSON': (r) => {
      try { return Array.isArray(r.json()); } catch { return false; }
    },
  });

  if (!listOk) operationErrors.add(1);

  const destinationUrl = `https://example.com/k6-vu-${__VU}-iter-${__ITER}`;

  res = http.post(
    `${BASE_URL}/api/links`,
    JSON.stringify({ destinationUrl }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /api/links' },
    }
  );

  createDuration.add(res.timings.duration);

  let created = null;

  const createOk = check(res, {
    'CREATE: status 201': (r) => r.status === 201,
    'CREATE: returns short code': (r) => {
      try { return Boolean(r.json('code')); } catch { return false; }
    },
  });

  if (createOk) created = res.json();
  else operationErrors.add(1);

  if (created?.code) {
    res = http.get(`${BASE_URL}/${created.code}`, {
      redirects: 0,
      tags: { name: 'GET /:code' },
    });

    redirectDuration.add(res.timings.duration);

    const redirectOk = check(res, {
      'REDIRECT: status 302': (r) => r.status === 302,
      'REDIRECT: correct Location': (r) => r.headers.Location === destinationUrl,
    });

    if (!redirectOk) operationErrors.add(1);
  }

  if (created?.id) {
    res = http.del(`${BASE_URL}/api/links/${created.id}`, {
      tags: { name: 'DELETE /api/links/:id' },
    });

    deleteDuration.add(res.timings.duration);

    const deleteOk = check(res, {
      'DELETE: status 200': (r) => r.status === 200,
    });

    if (!deleteOk) operationErrors.add(1);
  }

  sleep(0.1);
}
