import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";

interface AuthCardLinkProps {
  to: "/auth/login" | "/auth/signup" | "/auth/recover";
  className?: string;
  children: ReactNode;
}

export default function AuthCardLink({ to, className, children }: AuthCardLinkProps) {
  const navigate = useNavigate();
  const { key } = useLocation();
  const animation = useRef<Animation | null>(null);
  useEffect(() => () => {
    animation.current?.cancel();
    animation.current = null;
  }, [key]);

  const changeCard = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
      return;
    const card = event.currentTarget.closest<HTMLElement>(".auth-card-frame");
    if (!card?.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    if (animation.current) return;
    animation.current = card.animate(
      [{ opacity: getComputedStyle(card).opacity }, { opacity: 0, transform: "translateY(-5px)" }],
      { duration: 150, easing: "ease-in", fill: "forwards" },
    );
    void animation.current.finished.then(() => navigate(to), () => {});
  };

  return <Link to={to} className={className} onClick={changeCard}>{children}</Link>;
}
