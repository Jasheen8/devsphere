import React from 'react';
import { BirthdayExperience } from "./templates/BirthdayExperience";

type Props = { data: Record<string, any>; props?: Record<string, any>; theme?: Record<string, any> };
const Section = ({children}: {children: React.ReactNode}) => <section className="memora-section">{children}</section>;

export const Hero = ({data, props}: Props) => <Section><div className="hero"><p className="eyebrow">{props?.eyebrow ?? 'A little piece of our story'}</p><h1>{String(data.name ?? 'Your Beautiful Story')} <span>❤️</span></h1><p>{String(data.subtitle ?? 'Made with memories, made for you.')}</p></div></Section>;
export const Intro = ({data}: Props) => <Section><div className="intro"><h2>{String(data.partnerName ?? 'Someone Special')}</h2><p>{String(data.intro ?? 'Every memory feels better when it is shared.')}</p></div></Section>;
export const Timeline = ({data}: Props) => <Section><div className="timeline"><h2>Our Journey</h2>{(Array.isArray(data.timeline)?data.timeline:[]).map((item:any,i:number)=><article key={i}><span>{item.date}</span><h3>{item.title}</h3><p>{item.description}</p>{item.image && <img src={item.image} alt={item.title ?? 'Memory'} loading="lazy"/>}</article>)}</div></Section>;
export const Gallery = ({data}: Props) => <Section><div className="gallery"><h2>Memories</h2><div className="gallery-grid">{(Array.isArray(data.photos)?data.photos:[]).map((src:string,i:number)=><img key={i} src={src} alt={`Memory ${i+1}`} loading="lazy"/>)}</div></div></Section>;
export const Letter = ({data}: Props) => <Section><div className="letter"><h2>{String(data.letterTitle ?? 'A Letter For You')}</h2><p>{String(data.letter ?? 'Write your heart out here.')}</p></div></Section>;
export const Countdown = ({data}: Props) => <Section><div className="countdown"><h2>{String(data.countdownTitle ?? 'Until Our Next Celebration')}</h2><p data-countdown={data.countdownDate ?? ''}>Loading countdown…</p></div></Section>;
export const FinalMessage = ({data}: Props) => <Section><div className="final"><h2>{String(data.finalTitle ?? 'To Be Continued…')}</h2><p>{String(data.finalMessage ?? 'This is only another beautiful chapter.')}</p></div></Section>;

export const SectionRegistry: Record<
  string,
  React.ComponentType<Props>
> = {
  hero: Hero,
  intro: Intro,
  timeline: Timeline,
  gallery: Gallery,
  letter: Letter,
  countdown: Countdown,
  final: FinalMessage,

  "birthday-experience": BirthdayExperience,
};