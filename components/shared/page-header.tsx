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
}

export function PageHeader({ title, description, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="pt-16">
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
      <h1 className="text-4xl  mb-4">{title}</h1>
      {description && <p className="text-xl text-muted-foreground">{description}</p>}
    </div>
  );
}
