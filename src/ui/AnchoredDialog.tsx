import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";

/** Keep a modal close to its trigger while fitting the visible phone viewport. */
export function AnchoredDialog({
  anchor,
  dialogRef,
  onClose,
  children,
}: {
  anchor: HTMLElement | null;
  dialogRef: Ref<HTMLElement>;
  onClose: () => void;
  children: ReactNode;
}) {
  const element = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({
    left: 16,
    top: 16,
    maxHeight: "calc(100dvh - 32px)",
    maxWidth: "calc(100vw - 32px)",
  });
  useLayoutEffect(() => {
    const place = () => {
      if (!element.current) return;
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft ?? 0;
      const y = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? innerWidth;
      const height = viewport?.height ?? innerHeight;
      const rect = element.current.getBoundingClientRect();
      const trigger = anchor?.getBoundingClientRect();
      const dialogHeight = Math.min(rect.height, height - 32);
      const dialogWidth = Math.min(rect.width, Math.max(0, width - 32));
      const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value));
      const left = clamp(
        (trigger ? trigger.left + trigger.width / 2 : x + width / 2) -
          dialogWidth / 2,
        x + 16,
        x + width - dialogWidth - 16,
      );
      const above = trigger ? trigger.top - dialogHeight - 12 : y + 16;
      const preferred = trigger && above < y + 16 ? trigger.bottom + 12 : above;
      const top = clamp(preferred, y + 16, y + height - dialogHeight - 16);
      setPosition({
        left,
        top,
        maxHeight: `${Math.max(48, height - 32)}px`,
        maxWidth: `${Math.max(0, width - 32)}px`,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (element.current) observer.observe(element.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [anchor]);
  return (
    <div
      className="overlay anchored-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={(node) => {
          element.current = node;
          if (typeof dialogRef === "function") dialogRef(node);
          else if (dialogRef) dialogRef.current = node;
        }}
        className="dialog anchored-dialog"
        style={position}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        {children}
      </section>
    </div>
  );
}
