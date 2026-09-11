import { useEffect, useRef, type FC, type RefObject } from 'react';
import torsoImg from '../assets/robot-torso.png';
import headImg from '../assets/robot-head.png';
import faceImg from '../assets/robot-eyes.png';
import earLeftImg from '../assets/robot-ear-left.png';
import earRightImg from '../assets/robot-ear-right.png';
import handLeftImg from '../assets/robot-hand-left.png';
import handRightImg from '../assets/robot-hand-right.png';

/**
 * Multi-part interactive FAULTLINE robot.
 *
 * The source PNG (298x287) was segmented — offline, from its own pixels — into
 * SEVEN disjoint layers: torso, left/right ear, head (bezel + a flat screen
 * backing), face plate (the dark screen + glowing smile + HUD brackets), and
 * left/right hand. Every opaque source pixel belongs to exactly ONE layer, so
 * there is no full-robot base underneath and no duplicated pixels: at rest the
 * layers tile back into the exact original image, and when a part moves the
 * others stay put (a small joint collar on the torso/head keeps the seams
 * covered through the motion range).
 *
 * A single requestAnimationFrame loop writes `transform` straight to each
 * layer's DOM node — no React re-render on pointer move. Each part has its own
 * target / current / smoothing / range and its own un-synced idle oscillator.
 */

interface RobotCharacterProps {
  /** Element the cursor is tracked within (the hero section). */
  boundsRef: RefObject<HTMLElement | null>;
  isTracing?: boolean;
  onClick?: () => void;
  /** Low-frequency ( ~30fps ) normalized parallax value for ambient hero shapes. */
  onParallax?: (x: number, y: number) => void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const TAU = Math.PI * 2;

export const RobotCharacter: FC<RobotCharacterProps> = ({
  boundsRef,
  isTracing = false,
  onClick,
  onParallax,
}) => {
  const floatRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const torsoRef = useRef<HTMLImageElement>(null);
  const headRef = useRef<HTMLImageElement>(null);
  const faceRef = useRef<HTMLImageElement>(null);
  const earLRef = useRef<HTMLImageElement>(null);
  const earRRef = useRef<HTMLImageElement>(null);
  const handLRef = useRef<HTMLImageElement>(null);
  const handRRef = useRef<HTMLImageElement>(null);

  // All animation state lives in a ref — never triggers a render.
  const s = useRef({
    tx: 0, ty: 0, tProx: 0, // cursor target, normalized -1..1 relative to robot
    hx: 0, hy: 0, // head   (medium, laggy)
    fx: 0, fy: 0, // face   (fast, very subtle)
    elx: 0, erx: 0, // ears  (medium, asymmetric)
    lhx: 0, rhx: 0, // hands (slow, asymmetric)
    bx: 0, by: 0, // whole-composition parallax (very slow)
    prox: 0,
    reduced: false,
    mobile: false,
  });

  // --- cursor tracking (relative to the robot, inside the hero) --------------
  useEffect(() => {
    const st = s.current;
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const evalEnv = () => {
      st.reduced = mqReduce.matches;
      st.mobile =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth < 768;
    };
    evalEnv();

    const el = boundsRef.current;

    const onMove = (e: MouseEvent) => {
      if (st.mobile || st.reduced) return;
      const robot = floatRef.current;
      if (!robot) return;
      const r = robot.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const reachX = Math.max(window.innerWidth * 0.4, 320);
      const reachY = Math.max(window.innerHeight * 0.42, 280);
      st.tx = clamp(dx / reachX, -1, 1);
      st.ty = clamp(dy / reachY, -1, 1);
      st.tProx = clamp(1 - Math.hypot(dx, dy) / 420, 0, 1);
    };
    const relax = () => {
      st.tx = 0;
      st.ty = 0;
      st.tProx = 0;
    };

    el?.addEventListener('mousemove', onMove);
    el?.addEventListener('mouseleave', relax);
    window.addEventListener('blur', relax);
    window.addEventListener('resize', evalEnv);
    mqReduce.addEventListener?.('change', evalEnv);

    return () => {
      el?.removeEventListener('mousemove', onMove);
      el?.removeEventListener('mouseleave', relax);
      window.removeEventListener('blur', relax);
      window.removeEventListener('resize', evalEnv);
      mqReduce.removeEventListener?.('change', evalEnv);
    };
  }, [boundsRef]);

  // --- single 60fps kinematics + idle loop ----------------------------------
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    let lastCb = 0;

    const frame = (now: number) => {
      const st = s.current;
      const t = (now - t0) / 1000;
      const idle = st.reduced ? 0 : 1;
      const track = !st.mobile && !st.reduced;

      // Independent idle oscillators — deliberately un-synced periods.
      const torsoY = Math.sin(t * (TAU / 4.5)) * 4.5 * idle;
      const torsoScale = (Math.sin(t * (TAU / 4.5) - 1) * 0.5 + 0.5) * 0.01 * idle;
      const headBob = Math.sin(t * (TAU / 5.2)) * 1.3 * idle;
      const headRoll = Math.sin(t * (TAU / 5.2) + 0.6) * 0.8 * idle;
      const lhIdle = Math.sin(t * (TAU / 4.1)) * 1.5 * idle;
      const rhIdle = Math.sin(t * (TAU / 4.7) + 1.2) * 1.3 * idle;
      const elIdle = Math.sin(t * (TAU / 3.8)) * 1.0 * idle;
      const erIdle = Math.sin(t * (TAU / 3.4) + 0.9) * 1.2 * idle;
      const faceIdleX = Math.sin(t * (TAU / 6.0)) * 0.4 * idle;
      const faceIdleY = Math.cos(t * (TAU / 7.3)) * 0.3 * idle;

      const TX = track ? st.tx : 0;
      const TY = track ? st.ty : 0;
      const TP = track ? st.tProx : 0;

      // Per-part smoothing — each part reacts at its own speed.
      st.fx = lerp(st.fx, TX, 0.2);
      st.fy = lerp(st.fy, TY, 0.2); // face: fast
      st.hx = lerp(st.hx, TX, 0.085);
      st.hy = lerp(st.hy, TY, 0.085); // head: medium, laggy
      st.elx = lerp(st.elx, TX, 0.11); // ears: medium…
      st.erx = lerp(st.erx, TX, 0.13); // …slightly different
      st.lhx = lerp(st.lhx, TX, 0.055); // hands: slow…
      st.rhx = lerp(st.rhx, TX, 0.045); // …and different again
      st.bx = lerp(st.bx, TX, 0.035);
      st.by = lerp(st.by, TY, 0.035); // whole composition: very slow
      st.prox = lerp(st.prox, TP, 0.08);

      const p = st.prox;
      const headCarryY = torsoY * 0.85 + headBob + st.hy * 1.5;

      // TORSO — never tracks the cursor. Gentle breathing / float only.
      if (torsoRef.current) {
        const sc = 1 + torsoScale;
        torsoRef.current.style.transform = `translate3d(0px, ${torsoY.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
      }

      // HEAD — turn ±7° horizontal, tilt ±4° vertical, lags the cursor, idle roll.
      if (headRef.current) {
        const ry = st.hx * 7 * (1 + p * 0.15);
        const rx = -st.hy * 4;
        const rz = st.hx * 2 + headRoll;
        headRef.current.style.transform = `translate3d(0px, ${headCarryY.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
      }

      // FACE PLATE (eyes) — rides with the head, plus a very subtle internal
      // parallax glide inside the bezel so the gaze tracks the cursor.
      if (faceRef.current) {
        const fx = clamp(st.fx * (4.5 + p * 1.0) + faceIdleX, -5.5, 5.5);
        const fy = clamp(st.fy * (3.5 + p * 0.8) + faceIdleY, -4.5, 4.5);
        const fr = st.fx * 0.9;
        faceRef.current.style.transform = `translate3d(${fx.toFixed(2)}px, ${(headCarryY + fy).toFixed(2)}px, 0) rotateZ(${fr.toFixed(2)}deg)`;
      }

      // EARS — tiny rotation + shift, asymmetric, springy. Follow the head's bob.
      if (earLRef.current) {
        const rz = clamp(-st.elx * 3.4, -4, 4) + elIdle;
        const tx = clamp(-st.elx * 2, -2.5, 2.5);
        earLRef.current.style.transform = `translate3d(${tx.toFixed(2)}px, ${(torsoY * 0.9 + headBob * 0.6).toFixed(2)}px, 0) rotateZ(${rz.toFixed(2)}deg)`;
      }
      if (earRRef.current) {
        const rz = clamp(st.erx * 3.8, -4.5, 4.5) + erIdle;
        const tx = clamp(st.erx * 2, -2.5, 2.5);
        earRRef.current.style.transform = `translate3d(${tx.toFixed(2)}px, ${(torsoY * 0.9 + headBob * 0.6).toFixed(2)}px, 0) rotateZ(${rz.toFixed(2)}deg)`;
      }

      // HANDS — balancing motion. Left leans toward the cursor / counterbalances;
      // right answers with its own slightly larger, slower swing.
      if (handLRef.current) {
        const rz = clamp(-st.lhx * 5, -5, 5) + lhIdle;
        const ty = torsoY * 0.6 + clamp(-Math.abs(st.lhx) * 2.5, -4, 0) + lhIdle * 0.6;
        handLRef.current.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0) rotateZ(${rz.toFixed(2)}deg)`;
      }
      if (handRRef.current) {
        const rz = clamp(st.rhx * 5.5, -6, 6) + rhIdle;
        const ty = torsoY * 0.6 + clamp(-Math.abs(st.rhx) * 2.5, -4, 0) + rhIdle * 0.6;
        handRRef.current.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0) rotateZ(${rz.toFixed(2)}deg)`;
      }

      // WHOLE COMPOSITION — extremely subtle parallax drift only (never idle here;
      // idle lives per-part so the parts stay visually independent).
      if (floatRef.current) {
        const tx = st.bx * 6;
        const ty = st.by * 4;
        const sc = 1 + p * 0.01;
        floatRef.current.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
      }

      // GLOW — a touch more attentive when the cursor is close.
      if (glowRef.current) {
        glowRef.current.style.opacity = (0.26 + p * 0.16).toFixed(3);
        glowRef.current.style.transform = `scale(${(1.18 + p * 0.06).toFixed(3)})`;
      }

      if (onParallax && now - lastCb > 33) {
        onParallax(st.bx, st.by);
        lastCb = now;
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [onParallax]);

  const layer =
    'absolute inset-0 w-full h-full object-contain select-none pointer-events-none will-change-transform';

  return (
    <div
      className="relative z-10 flex flex-col items-center justify-center cursor-pointer group select-none"
      onClick={onClick}
      title="Click to run live multi-agent failure trace!"
    >
      <div
        ref={floatRef}
        className="relative w-48 sm:w-56 md:w-64 will-change-transform"
        style={{ aspectRatio: '298 / 287', perspective: '900px', filter: 'drop-shadow(0 18px 24px rgba(30, 27, 75, 0.18))' }}
      >
        {/* Luminous ambient halo */}
        <div
          ref={glowRef}
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-400/30 via-fuchsia-300/35 to-indigo-300/30 blur-2xl pointer-events-none"
          style={{ transform: 'scale(1.18)', opacity: 0.26 }}
        />

        {/* z1: torso / body — the anchor, never tracks the cursor */}
        <img ref={torsoRef} src={torsoImg} alt="FAULTLINE AI System Inspector" className={`${layer} z-[1]`} draggable={false} />

        {/* z2: ears — behind the head */}
        <img ref={earLRef} src={earLeftImg} alt="" aria-hidden className={`${layer} z-[2]`} draggable={false} style={{ transformOrigin: '32% 33%' }} />
        <img ref={earRRef} src={earRightImg} alt="" aria-hidden className={`${layer} z-[2]`} draggable={false} style={{ transformOrigin: '88% 34%' }} />

        {/* z3: head bezel (+ flat screen backing) — pivots at the neck */}
        <img ref={headRef} src={headImg} alt="" aria-hidden className={`${layer} z-[3]`} draggable={false} style={{ transformOrigin: '58% 54%' }} />

        {/* z4: face plate — dark screen + glowing smile, glides subtly inside the bezel */}
        <img ref={faceRef} src={faceImg} alt="" aria-hidden className={`${layer} z-[4]`} draggable={false} style={{ transformOrigin: '60% 28%' }} />

        {/* z5: hands — in front, pivot at the shoulder */}
        <img ref={handLRef} src={handLeftImg} alt="" aria-hidden className={`${layer} z-[5]`} draggable={false} style={{ transformOrigin: '25% 38%' }} />
        <img ref={handRRef} src={handRightImg} alt="" aria-hidden className={`${layer} z-[5]`} draggable={false} style={{ transformOrigin: '75% 63%' }} />

        {/* Live diagnostic pulse pill */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-[7] px-3 py-1 rounded-full bg-white/95 border border-slate-200/90 shadow-md flex items-center gap-1.5 whitespace-nowrap text-[10.5px] font-bold text-slate-700">
          <span className={`w-2 h-2 rounded-full ${isTracing ? 'bg-pink-500 animate-ping' : 'bg-emerald-500'}`} />
          {isTracing ? 'ANALYZING TRACE...' : 'AI AGENT FLEET'}
        </div>
      </div>
    </div>
  );
};
