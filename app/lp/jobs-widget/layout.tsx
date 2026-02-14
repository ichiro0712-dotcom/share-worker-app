export const metadata = { title: 'おすすめ求人' };

export default function JobsWidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-transparent">{children}</div>
  );
}
