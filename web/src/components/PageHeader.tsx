import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function PageHeader({ eyebrow, title, description, action }: Props) {
  return (
    <header className="page-header">
      <div>
        <p className="page-header__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-header__description">{description}</p>
      </div>
      {action !== undefined && <div className="page-header__action">{action}</div>}
    </header>
  );
}
