import { describe, it, expect } from 'vitest';
import { filterRemoteData } from '../cursor';
import type { LiveTransformData, LiveEditingData } from '../../types';

describe('filterRemoteData', () => {
  it('should return empty object when no data', () => {
    expect(filterRemoteData({}, 'user-1')).toEqual({});
  });

  it('should exclude the local user', () => {
    const all: Record<string, LiveTransformData> = {
      'user-1': {
        objectId: 'obj-1', x: 0, y: 0, width: 100, height: 100,
        rotation: 0, userName: 'Me', userColor: '#000', lastActive: 1,
      },
      'user-2': {
        objectId: 'obj-2', x: 10, y: 10, width: 200, height: 200,
        rotation: 0, userName: 'Alice', userColor: '#fff', lastActive: 2,
      },
    };
    const result = filterRemoteData(all, 'user-1');
    expect(result['user-1']).toBeUndefined();
    expect(result['user-2']).toBeDefined();
    expect(result['user-2'].userName).toBe('Alice');
  });

  it('should return all entries when local user is absent', () => {
    const all: Record<string, LiveEditingData> = {
      'user-2': { objectId: 'o1', text: 'a', userName: 'Alice', userColor: '#f00', lastActive: 1 },
      'user-3': { objectId: 'o2', text: 'b', userName: 'Bob', userColor: '#0f0', lastActive: 2 },
    };
    const result = filterRemoteData(all, 'user-1');
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('should return empty when all entries belong to local user', () => {
    const all = {
      'user-1': { value: 'solo' },
    };
    const result = filterRemoteData(all, 'user-1');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should work with generic types', () => {
    // Proves generic T works with arbitrary shape
    const all = {
      'user-1': { foo: 'bar' },
      'user-2': { foo: 'baz' },
    };
    const result = filterRemoteData(all, 'user-1');
    expect(result['user-2'].foo).toBe('baz');
  });
});
