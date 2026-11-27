import { Card, Empty, PageHeader } from "@/components/ui";
import { TaskRow } from "@/components/task-row";
import { TaskForm } from "@/components/task-form";
import { doneTasks, dueTasks, undatedTasks, upcomingTasks } from "@/lib/task-queries";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const [due, upcoming, undated, done] = await Promise.all([dueTasks(), upcomingTasks(), undatedTasks(), doneTasks()]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Tasks" subtitle="Follow-ups are created automatically when you log calls." />
      <Card className="mb-6 p-3">
        <TaskForm />
      </Card>
      <div className="space-y-6">
        <Card title={`Today and overdue (${due.length})`}>
          {due.length ? <ul className="divide-y divide-ink-700/60">{due.map((t) => <TaskRow key={t.id} t={t} />)}</ul> : <Empty title="Nothing due" />}
        </Card>
        <Card title={`Upcoming (${upcoming.length})`}>
          {upcoming.length ? <ul className="divide-y divide-ink-700/60">{upcoming.map((t) => <TaskRow key={t.id} t={t} />)}</ul> : <Empty title="Nothing scheduled" />}
        </Card>
        {undated.length > 0 && (
          <Card title={`No due date (${undated.length})`}>
            <ul className="divide-y divide-ink-700/60">{undated.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
          </Card>
        )}
        {done.length > 0 && (
          <Card title="Recently completed">
            <ul className="divide-y divide-ink-700/60">{done.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
          </Card>
        )}
      </div>
    </div>
  );
}
