import { Metadata } from "next";
import { AddShowForm } from "./add-show-form";

export const metadata: Metadata = {
  title: "Add Show | WorldwideFM",
  description: "Add a new show to the WorldwideFM schedule",
};

export default function AddShowPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-h4 font-display uppercase font-normal text-almostblack mb-6">Add Show</h1>
      <div className="bg-background border rounded-none p-6">
        <AddShowForm />
      </div>
    </div>
  );
}
