import { vi } from 'vitest';

/**
 * In-memory Redis storage for testing
 */
class InMemoryRedis {
  private storage: Map<string, { value: string; expireAt?: number }> = new Map();
  private hashStorage: Map<string, Map<string, string>> = new Map();
  private setStorage: Map<string, Set<string>> = new Map();
  private listStorage: Map<string, string[]> = new Map();

  // String operations
  get(key: string): string | null {
    const item = this.storage.get(key);
    if (!item) return null;
    if (item.expireAt && Date.now() > item.expireAt) {
      this.storage.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: string, mode?: string, duration?: number): 'OK' {
    let expireAt: number | undefined;
    if (mode === 'EX' && duration) {
      expireAt = Date.now() + duration * 1000;
    } else if (mode === 'PX' && duration) {
      expireAt = Date.now() + duration;
    }
    this.storage.set(key, { value, expireAt });
    return 'OK';
  }

  del(...keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      if (this.storage.delete(key)) count++;
      if (this.hashStorage.delete(key)) count++;
      if (this.setStorage.delete(key)) count++;
      if (this.listStorage.delete(key)) count++;
    }
    return count;
  }

  exists(...keys: string[]): number {
    return keys.filter((key) => this.storage.has(key)).length;
  }

  expire(key: string, seconds: number): number {
    const item = this.storage.get(key);
    if (!item) return 0;
    item.expireAt = Date.now() + seconds * 1000;
    return 1;
  }

  ttl(key: string): number {
    const item = this.storage.get(key);
    if (!item) return -2;
    if (!item.expireAt) return -1;
    const remaining = Math.ceil((item.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  incr(key: string): number {
    const current = this.get(key);
    const newValue = (parseInt(current || '0', 10) + 1).toString();
    this.set(key, newValue);
    return parseInt(newValue, 10);
  }

  incrby(key: string, increment: number): number {
    const current = this.get(key);
    const newValue = (parseInt(current || '0', 10) + increment).toString();
    this.set(key, newValue);
    return parseInt(newValue, 10);
  }

  // Hash operations
  hget(key: string, field: string): string | null {
    return this.hashStorage.get(key)?.get(field) || null;
  }

  hset(key: string, field: string, value: string): number {
    if (!this.hashStorage.has(key)) {
      this.hashStorage.set(key, new Map());
    }
    const isNew = !this.hashStorage.get(key)!.has(field);
    this.hashStorage.get(key)!.set(field, value);
    return isNew ? 1 : 0;
  }

  hdel(key: string, ...fields: string[]): number {
    const hash = this.hashStorage.get(key);
    if (!hash) return 0;
    let count = 0;
    for (const field of fields) {
      if (hash.delete(field)) count++;
    }
    return count;
  }

  hgetall(key: string): Record<string, string> {
    const hash = this.hashStorage.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash);
  }

  // Set operations
  sadd(key: string, ...members: string[]): number {
    if (!this.setStorage.has(key)) {
      this.setStorage.set(key, new Set());
    }
    const set = this.setStorage.get(key)!;
    let count = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        count++;
      }
    }
    return count;
  }

  srem(key: string, ...members: string[]): number {
    const set = this.setStorage.get(key);
    if (!set) return 0;
    let count = 0;
    for (const member of members) {
      if (set.delete(member)) count++;
    }
    return count;
  }

  smembers(key: string): string[] {
    const set = this.setStorage.get(key);
    return set ? Array.from(set) : [];
  }

  sismember(key: string, member: string): number {
    const set = this.setStorage.get(key);
    return set?.has(member) ? 1 : 0;
  }

  // List operations
  lpush(key: string, ...values: string[]): number {
    if (!this.listStorage.has(key)) {
      this.listStorage.set(key, []);
    }
    const list = this.listStorage.get(key)!;
    list.unshift(...values.reverse());
    return list.length;
  }

  rpush(key: string, ...values: string[]): number {
    if (!this.listStorage.has(key)) {
      this.listStorage.set(key, []);
    }
    const list = this.listStorage.get(key)!;
    list.push(...values);
    return list.length;
  }

  lpop(key: string): string | null {
    const list = this.listStorage.get(key);
    if (!list || list.length === 0) return null;
    return list.shift() || null;
  }

  rpop(key: string): string | null {
    const list = this.listStorage.get(key);
    if (!list || list.length === 0) return null;
    return list.pop() || null;
  }

  lrange(key: string, start: number, stop: number): string[] {
    const list = this.listStorage.get(key);
    if (!list) return [];
    if (stop < 0) stop = list.length + stop + 1;
    else stop = stop + 1;
    return list.slice(start, stop);
  }

  llen(key: string): number {
    return this.listStorage.get(key)?.length || 0;
  }

  // Utility
  keys(pattern: string): string[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.storage.keys()).filter((key) => regex.test(key));
  }

  flushall(): 'OK' {
    this.storage.clear();
    this.hashStorage.clear();
    this.setStorage.clear();
    this.listStorage.clear();
    return 'OK';
  }

  flushdb(): 'OK' {
    return this.flushall();
  }
}

/**
 * Create a mock Redis client (ioredis compatible)
 */
export function createMockRedisClient() {
  const inMemory = new InMemoryRedis();

  const mockClient = {
    _storage: inMemory,

    // Connection
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    ping: vi.fn().mockResolvedValue('PONG'),

    // String operations
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(inMemory.get(key))),
    set: vi.fn().mockImplementation(
      (key: string, value: string, ...args: any[]) => {
        if (args[0] === 'EX' || args[0] === 'PX') {
          return Promise.resolve(inMemory.set(key, value, args[0], args[1]));
        }
        return Promise.resolve(inMemory.set(key, value));
      }
    ),
    del: vi.fn().mockImplementation((...keys: string[]) => Promise.resolve(inMemory.del(...keys))),
    exists: vi.fn().mockImplementation((...keys: string[]) => Promise.resolve(inMemory.exists(...keys))),
    expire: vi.fn().mockImplementation((key: string, seconds: number) => Promise.resolve(inMemory.expire(key, seconds))),
    ttl: vi.fn().mockImplementation((key: string) => Promise.resolve(inMemory.ttl(key))),
    incr: vi.fn().mockImplementation((key: string) => Promise.resolve(inMemory.incr(key))),
    incrby: vi.fn().mockImplementation((key: string, increment: number) => Promise.resolve(inMemory.incrby(key, increment))),

    // Hash operations
    hget: vi.fn().mockImplementation((key: string, field: string) => Promise.resolve(inMemory.hget(key, field))),
    hset: vi.fn().mockImplementation((key: string, field: string, value: string) => Promise.resolve(inMemory.hset(key, field, value))),
    hdel: vi.fn().mockImplementation((key: string, ...fields: string[]) => Promise.resolve(inMemory.hdel(key, ...fields))),
    hgetall: vi.fn().mockImplementation((key: string) => Promise.resolve(inMemory.hgetall(key))),

    // Set operations
    sadd: vi.fn().mockImplementation((key: string, ...members: string[]) => Promise.resolve(inMemory.sadd(key, ...members))),
    srem: vi.fn().mockImplementation((key: string, ...members: string[]) => Promise.resolve(inMemory.srem(key, ...members))),
    smembers: vi.fn().mockImplementation((key: string) => Promise.resolve(inMemory.smembers(key))),
    sismember: vi.fn().mockImplementation((key: string, member: string) => Promise.resolve(inMemory.sismember(key, member))),

    // List operations
    lpush: vi.fn().mockImplementation((key: string, ...values: string[]) => Promise.resolve(inMemory.lpush(key, ...values))),
    rpush: vi.fn().mockImplementation((key: string, ...values: string[]) => Promise.resolve(inMemory.rpush(key, ...values))),
    lpop: vi.fn().mockImplementation((key: string) => Promise.resolve(inMemory.lpop(key))),
    rpop: vi.fn().mockImplementation((key: string) => Promise.resolve(inMemory.rpop(key))),
    lrange: vi.fn().mockImplementation((key: string, start: number, stop: number) => Promise.resolve(inMemory.lrange(key, start, stop))),
    llen: vi.fn().mockImplementation((key: string) => Promise.resolve(inMemory.llen(key))),

    // Utility
    keys: vi.fn().mockImplementation((pattern: string) => Promise.resolve(inMemory.keys(pattern))),
    flushall: vi.fn().mockImplementation(() => Promise.resolve(inMemory.flushall())),
    flushdb: vi.fn().mockImplementation(() => Promise.resolve(inMemory.flushdb())),

    // Events
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn(),

    // Status
    status: 'ready',

    // Pipeline
    pipeline: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),

    // Multi
    multi: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  };

  return mockClient;
}

/**
 * Setup Redis mock module
 */
export function setupRedisMock() {
  const mockClient = createMockRedisClient();

  vi.mock('ioredis', () => ({
    default: vi.fn().mockImplementation(() => mockClient),
    Redis: vi.fn().mockImplementation(() => mockClient),
  }));

  return mockClient;
}

/**
 * Create mock BullMQ queue
 */
export function createMockQueue() {
  const jobs: Map<string, any> = new Map();
  let jobIdCounter = 0;

  return {
    name: 'test-queue',

    add: vi.fn().mockImplementation((name: string, data: any, opts?: any) => {
      const jobId = (++jobIdCounter).toString();
      const job = {
        id: jobId,
        name,
        data,
        opts,
        progress: 0,
        attemptsMade: 0,
        timestamp: Date.now(),
        returnvalue: undefined,
        failedReason: undefined,
      };
      jobs.set(jobId, job);
      return Promise.resolve(job);
    }),

    addBulk: vi.fn().mockImplementation((items: any[]) => {
      return Promise.all(
        items.map((item) => ({
          id: (++jobIdCounter).toString(),
          name: item.name,
          data: item.data,
          opts: item.opts,
        }))
      );
    }),

    getJob: vi.fn().mockImplementation((jobId: string) => {
      return Promise.resolve(jobs.get(jobId) || null);
    }),

    getJobs: vi.fn().mockImplementation(() => {
      return Promise.resolve(Array.from(jobs.values()));
    }),

    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    }),

    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    obliterate: vi.fn().mockResolvedValue(undefined),

    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),

    // Test utility
    _jobs: jobs,
    _clear: () => {
      jobs.clear();
      jobIdCounter = 0;
    },
  };
}

/**
 * Create mock BullMQ worker
 */
export function createMockWorker() {
  return {
    name: 'test-worker',
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isRunning: vi.fn().mockReturnValue(true),
    isPaused: vi.fn().mockReturnValue(false),
  };
}
