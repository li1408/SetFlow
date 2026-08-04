import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowUpRight, Dumbbell, LockKeyhole, Sparkles } from "lucide-react";
import "./app.css";

gsap.registerPlugin(useGSAP);

export function App() {
  const appRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          compact: "(max-height: 700px)",
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            gsap.set(".js-reveal", { clearProps: "all" });
            return;
          }

          const distance = context.conditions?.compact ? 12 : 20;
          const timeline = gsap.timeline({
            defaults: { duration: 0.5, ease: "power2.out" },
          });

          timeline
            .from(".js-brand", { autoAlpha: 0, y: -distance })
            .from(
              ".js-reveal",
              { autoAlpha: 0, y: distance, stagger: 0.08 },
              "<0.12",
            )
            .from(
              ".js-orbit",
              { autoAlpha: 0, scale: 0.94, duration: 0.65 },
              "<0.08",
            );
        },
      );

      return () => media.revert();
    },
    { scope: appRef },
  );

  return (
    <div className="app" ref={appRef}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <header className="topbar js-brand">
        <div className="brand-mark" aria-hidden="true">
          <Dumbbell size={18} strokeWidth={2.4} />
        </div>
        <div>
          <p className="brand-name">SETFLOW</p>
          <p className="brand-caption">本地训练助手</p>
        </div>
        <div className="local-badge">
          <LockKeyhole size={13} aria-hidden="true" />
          <span>仅本机</span>
        </div>
      </header>

      <main className="main" id="main-content">
        <section className="hero" aria-labelledby="today-title">
          <p className="eyebrow js-reveal">
            <Sparkles size={14} aria-hidden="true" />
            你的下一次训练，从这里开始
          </p>
          <h1 className="hero-title js-reveal" id="today-title">
            今天，开始动起来
          </h1>
          <p className="hero-copy js-reveal">
            创建一个适合你时间、经验和器械条件的计划。完成每组后，SetFlow 会接管休息节奏。
          </p>
        </section>

        <section className="readiness js-reveal" aria-label="计划状态">
          <div className="orbit js-orbit" aria-hidden="true">
            <div className="orbit-inner">
              <span className="orbit-value">0</span>
              <span className="orbit-label">待训练</span>
            </div>
          </div>

          <div className="readiness-copy">
            <p className="status-label">当前状态</p>
            <h2>还没有训练计划</h2>
            <p>先用规则自动生成，也可以从空白计划开始。</p>
          </div>
        </section>

        <button className="primary-action js-reveal" type="button">
          <span>创建我的计划</span>
          <ArrowUpRight size={21} aria-hidden="true" />
        </button>

        <p className="privacy-note js-reveal">
          无需账号 · 无需联网 · 训练记录只保存在这台设备
        </p>
      </main>

      <footer className="build-note js-reveal">
        <span>SETFLOW / MVP 01</span>
        <span>为小米 15 优先验证</span>
      </footer>
    </div>
  );
}
