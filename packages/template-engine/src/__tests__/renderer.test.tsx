import {describe,it,expect} from 'vitest';
import {SectionRegistry} from '../sections';

describe('template engine',()=>{it('registers reusable sections',()=>{expect(SectionRegistry.hero).toBeDefined();expect(SectionRegistry.timeline).toBeDefined();expect(SectionRegistry.gallery).toBeDefined();});});
