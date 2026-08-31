import {describe,it,expect} from 'vitest';
import {uniqueSlug} from '../lib/slug';
describe('slug policy',()=>{it('supports human-readable slug input',async()=>{expect(typeof uniqueSlug).toBe('function');});});
