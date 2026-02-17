import { describe, it, expect } from 'vitest';
import type { LiveTransformData, LiveEditingData } from '../index';

describe('LiveTransformData type', () => {
  it('should allow construction of a valid LiveTransformData object', () => {
    const data: LiveTransformData = {
      objectId: 'obj-1',
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      rotation: 45,
      userName: 'Alice',
      userColor: '#FF6B6B',
      lastActive: Date.now(),
    };
    expect(data.objectId).toBe('obj-1');
    expect(data.x).toBe(100);
    expect(data.y).toBe(200);
    expect(data.width).toBe(300);
    expect(data.height).toBe(150);
    expect(data.rotation).toBe(45);
    expect(data.userName).toBe('Alice');
    expect(data.userColor).toBe('#FF6B6B');
    expect(typeof data.lastActive).toBe('number');
  });

  it('should require all fields', () => {
    // This test verifies the shape - all fields are mandatory
    const data: LiveTransformData = {
      objectId: '',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      userName: '',
      userColor: '',
      lastActive: 0,
    };
    expect(Object.keys(data)).toHaveLength(9);
  });
});

describe('LiveEditingData type', () => {
  it('should allow construction of a valid LiveEditingData object', () => {
    const data: LiveEditingData = {
      objectId: 'obj-2',
      text: 'Hello world',
      userName: 'Bob',
      userColor: '#51CF66',
      lastActive: Date.now(),
    };
    expect(data.objectId).toBe('obj-2');
    expect(data.text).toBe('Hello world');
    expect(data.userName).toBe('Bob');
    expect(data.userColor).toBe('#51CF66');
    expect(typeof data.lastActive).toBe('number');
  });

  it('should require all fields', () => {
    const data: LiveEditingData = {
      objectId: '',
      text: '',
      userName: '',
      userColor: '',
      lastActive: 0,
    };
    expect(Object.keys(data)).toHaveLength(5);
  });
});
