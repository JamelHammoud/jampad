import { Link as RRLink, useLocation, useNavigate } from "react-router-dom";
import type { ComponentProps, ReactNode } from "react";

type LinkProps = {
  href: string;
  children?: ReactNode;
} & Omit<ComponentProps<typeof RRLink>, "to" | "children">;

export function Link({ href, children, ...rest }: LinkProps) {
  return (
    <RRLink to={href} {...rest}>
      {children}
    </RRLink>
  );
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => navigate(0 as unknown as string),
  };
}
