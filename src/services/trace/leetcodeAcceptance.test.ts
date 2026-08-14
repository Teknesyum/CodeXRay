import { describe, expect, it } from 'vitest';
import type { TraceValue } from '../../types/simulation';
import { traceJavaScript } from './jsTracer';

interface Case {
  name: string;
  source: string;
  args: TraceValue[];
  expected: TraceValue;
}

const cases: Case[] = [
  { name: 'two sum', source: `function solve(nums, target) { const seen = new Map(); for (let i = 0; i < nums.length; i++) { const need = target - nums[i]; if (seen.has(need)) return [seen.get(need), i]; seen.set(nums[i], i); } return []; }`, args: [[2, 7, 11, 15], 9], expected: [0, 1] },
  { name: 'valid parentheses', source: `function solve(s) { const stack = []; const pairs = {')':'(',']':'[','}':'{'}; for (const ch of s) { if (ch in pairs) { if (stack.pop() !== pairs[ch]) return false; } else stack.push(ch); } return stack.length === 0; }`, args: ['([])'], expected: true },
  { name: 'binary search', source: `function solve(nums, target) { let lo = 0, hi = nums.length - 1; while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); if (nums[mid] === target) return mid; if (nums[mid] < target) lo = mid + 1; else hi = mid - 1; } return -1; }`, args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
  { name: 'maximum subarray', source: `function solve(nums) { let best = nums[0], current = nums[0]; for (let i = 1; i < nums.length; i++) { current = Math.max(nums[i], current + nums[i]); best = Math.max(best, current); } return best; }`, args: [[-2,1,-3,4,-1,2,1,-5,4]], expected: 6 },
  { name: 'contains duplicate', source: `function solve(nums) { const seen = new Set(); for (const value of nums) { if (seen.has(value)) return true; seen.add(value); } return false; }`, args: [[1,2,3,1]], expected: true },
  { name: 'majority element', source: `function solve(nums) { let candidate = 0, count = 0; for (const value of nums) { if (count === 0) candidate = value; count += value === candidate ? 1 : -1; } return candidate; }`, args: [[2,2,1,1,1,2,2]], expected: 2 },
  { name: 'climbing stairs', source: `function solve(n) { if (n <= 2) return n; let a = 1, b = 2; for (let i = 3; i <= n; i++) { const next = a + b; a = b; b = next; } return b; }`, args: [6], expected: 13 },
  { name: 'fibonacci', source: `function solve(n) { const memo = new Map(); function f(x) { if (x < 2) return x; if (memo.has(x)) return memo.get(x); const value = f(x - 1) + f(x - 2); memo.set(x, value); return value; } return f(n); }`, args: [10], expected: 55 },
  { name: 'move zeroes', source: `function solve(nums) { let write = 0; for (const value of nums) if (value !== 0) nums[write++] = value; while (write < nums.length) nums[write++] = 0; return nums; }`, args: [[0,1,0,3,12]], expected: [1,3,12,0,0] },
  { name: 'best stock profit', source: `function solve(prices) { let low = Infinity, best = 0; for (const price of prices) { low = Math.min(low, price); best = Math.max(best, price - low); } return best; }`, args: [[7,1,5,3,6,4]], expected: 5 },
  { name: 'reverse string', source: `function solve(s) { let left = 0, right = s.length - 1; while (left < right) { const temp = s[left]; s[left++] = s[right]; s[right--] = temp; } return s; }`, args: [['h','e','l','l','o']], expected: ['o','l','l','e','h'] },
  { name: 'merge sorted arrays', source: `function solve(a, b) { const out = []; let i = 0, j = 0; while (i < a.length || j < b.length) { if (j >= b.length || (i < a.length && a[i] <= b[j])) out.push(a[i++]); else out.push(b[j++]); } return out; }`, args: [[1,3,5],[2,4,6]], expected: [1,2,3,4,5,6] },
  { name: 'longest common prefix', source: `function solve(words) { let prefix = words[0]; for (let i = 1; i < words.length; i++) while (!words[i].startsWith(prefix)) prefix = prefix.slice(0, -1); return prefix; }`, args: [['flower','flow','flight']], expected: 'fl' },
  { name: 'palindrome', source: `function solve(s) { const clean = s.toLowerCase().split('').filter(ch => ch >= 'a' && ch <= 'z').join(''); return clean === clean.split('').reverse().join(''); }`, args: ['A man a plan a canal Panama'], expected: true },
  { name: 'single number', source: `function solve(nums) { return nums.reduce((result, value) => result ^ value, 0); }`, args: [[4,1,2,1,2]], expected: 4 },
  { name: 'intersection', source: `function solve(a, b) { const right = new Set(); for (const value of b) right.add(value); const result = new Set(); for (const value of a) if (right.has(value)) result.add(value); return [...result]; }`, args: [[1,2,2,1],[2,2]], expected: [2] },
  { name: 'running sum', source: `function solve(nums) { const out = []; let sum = 0; nums.forEach(value => { sum += value; out.push(sum); }); return out; }`, args: [[1,2,3,4]], expected: [1,3,6,10] },
  { name: 'plus one', source: `function solve(digits) { for (let i = digits.length - 1; i >= 0; i--) { if (digits[i] < 9) { digits[i]++; return digits; } digits[i] = 0; } digits.unshift(1); return digits; }`, args: [[9,9]], expected: [1,0,0] },
  { name: 'sqrt integer', source: `function solve(x) { if (x < 2) return x; let lo = 1, hi = x; while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); if (mid * mid <= x && (mid + 1) * (mid + 1) > x) return mid; if (mid * mid > x) hi = mid - 1; else lo = mid + 1; } return -1; }`, args: [17], expected: 4 },
  { name: 'house robber', source: `function solve(nums) { let previous = 0, current = 0; for (const value of nums) { const next = Math.max(current, previous + value); previous = current; current = next; } return current; }`, args: [[2,7,9,3,1]], expected: 12 },
];

describe('JavaScript tracer LeetCode acceptance', () => {
  it.each(cases)('executes $name', ({ source, args, expected }) => {
    const trace = traceJavaScript(source, { functionName: 'solve', args });
    expect(trace.error).toBeNull();
    expect(trace.truncated).toBe(false);
    expect(trace.returnValue).toEqual(expected);
    expect(trace.steps.length).toBeGreaterThan(0);
  });
});
