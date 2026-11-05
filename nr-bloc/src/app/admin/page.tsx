import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { getAllEvents } from "@/lib/events";
import { formatShort, todayInLondon } from "@/lib/formatDate";
import EventForm from "@/components/admin/EventForm";
import DeleteEventButton from "@/components/admin/DeleteEventButton";
import LogoutButton from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await verifySession())) {
    redirect("/admin/login");
  }

  const today = todayInLondon();
  const events = getAllEvents();
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today).reverse();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="pixel-shadow text-2xl text-white">Admin</h1>
        <LogoutButton />
      </div>

      <div className="panel-pink mt-8 p-6 sm:p-8">
        <h2 className="text-base text-white">Add an Event</h2>
        <div className="mt-6">
          <EventForm />
        </div>
      </div>

      {[
        { title: "Upcoming", list: upcoming },
        { title: "Past", list: past },
      ].map(
        ({ title, list }) =>
          list.length > 0 && (
            <div key={title} className="mt-12">
              <h2 className="border-b-2 border-line pb-3 text-sm text-white">{title}</h2>
              <ul>
                {list.map((e) => (
                  <li
                    key={e.slug}
                    className="flex items-center justify-between gap-4 border-b-2 border-line py-4"
                  >
                    <div>
                      <p className="font-pixel text-[0.6rem] uppercase text-cyan">
                        {formatShort(e.date)}
                      </p>
                      <p className="mt-1 text-white">{e.title}</p>
                    </div>
                    <DeleteEventButton slug={e.slug} title={e.title} poster={e.poster} />
                  </li>
                ))}
              </ul>
            </div>
          )
      )}
      <p className="mt-6 text-sm text-foreground-dim">
        Deleted or added events take a minute or two to show up here, once the site rebuilds.
      </p>
    </div>
  );
}
