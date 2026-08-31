import React, {useEffect} from 'react';
import { SectionRegistry } from './sections';
import type { TemplateDefinition, ProjectData } from '@memora/shared';
import './styles.css';

export type RenderProps = { template: TemplateDefinition; data: ProjectData; customization?: Record<string, any>; isPreview?: boolean };

function CountdownBinder(){ useEffect(()=>{ const els=[...document.querySelectorAll<HTMLElement>('[data-countdown]')]; const tick=()=>els.forEach(el=>{const target=new Date(el.dataset.countdown||'').getTime(); if(!target||Number.isNaN(target)) return; const diff=Math.max(0,target-Date.now()); const d=Math.floor(diff/86400000), h=Math.floor(diff/3600000)%24, m=Math.floor(diff/60000)%60, s=Math.floor(diff/1000)%60; el.textContent=`${d}d ${h}h ${m}m ${s}s`;}); tick(); const t=window.setInterval(tick,1000); return()=>window.clearInterval(t);},[]); return null; }

export function TemplateRenderer({
  template,
  data,
  customization,
  isPreview = false,
}: RenderProps & {
  isPreview?: boolean;
}) {
  const style = {
    '--accent': customization?.accent ?? '#9b6b5d',
    '--bg': customization?.background ?? '#fffaf7',
    '--text': customization?.text ?? '#302321',
  } as React.CSSProperties;

  return (
    <div
      className={`memora-site animation-${
        customization?.animation ?? 'smooth'
      }`}
      style={style}
    >
      {template.sections
        .filter((section) => section.enabled)
        .map((section) => {
          const C = SectionRegistry[section.type];

          return C ? (
            <C
  data={data}
  props={section.props}
  theme={customization}
  isPreview={isPreview}
/>
          ) : null;
        })}

      <CountdownBinder />
    </div>
  );
}