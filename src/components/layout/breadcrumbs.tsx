"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function isLikelyId(segment: string) {
  return /^[a-z0-9]{20,}$/i.test(segment) && /\d/.test(segment);
}

// Path prefixes that have no page of their own: link to the closest real page, or
// render as plain text (null) so a breadcrumb never leads to a 404.
const CRUMB_HREF_OVERRIDES: Record<string, string | null> = {
  "/stock": null,
  "/sales": "/sales/orders",
  "/operations": null,
  "/dispatch/trips": "/dispatch",
  "/gate/[id]": null,
};

function crumbHref(href: string): string | null {
  const pattern = href
    .split("/")
    .map((s) => (isLikelyId(s) ? "[id]" : s))
    .join("/");
  return pattern in CRUMB_HREF_OVERRIDES ? CRUMB_HREF_OVERRIDES[pattern] : href;
}

function toLabel(segment: string) {
  if (isLikelyId(segment)) return "Details";
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, idx) => {
    const href = `/${segments.slice(0, idx + 1).join("/")}`;
    return { label: toLabel(segment), href, linkHref: crumbHref(href), isLast: idx === segments.length - 1 };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : crumb.linkHref ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.linkHref}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <span>{crumb.label}</span>
              )}
            </BreadcrumbItem>
            {!crumb.isLast && <BreadcrumbSeparator />}
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
