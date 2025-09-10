import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  href?: string;
  label: string;
  key?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  paddingTop?: boolean;
  className?: string;
}

export function PageHeader({ title, description, breadcrumbs, paddingTop = true, className }: PageHeaderProps) {
  return (
    <div className={`${paddingTop ? "mt-4" : "pt-4"}`}>
      {/* Breadcrumb navigation */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          {breadcrumbs.map((item, index) => (
            <div key={`breadcrumb-${item.key || `${item.href || ""}-${item.label}`}-${index}`} className="flex items-center gap-2">
              {item.href ? (
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4" />}
            </div>
          ))}
        </nav>
      )}

      {/* Page title and description */}
      <h1 className={`text-[40px] sm:text-h5 font-display tracking-tight uppercase text-almostblack dark:text-white mb-4 text-left leading-10 sm:leading-15 ${className || ""}`}>{title}</h1>
      {description && <p className="text-xl text-muted-foreground text-center">{description}</p>}
    </div>
  );
}
