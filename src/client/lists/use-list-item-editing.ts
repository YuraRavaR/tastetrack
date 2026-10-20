import { useState } from "react";
import type { ListItem } from "../../shared/api";
import * as api from "../api";

// Why the last change to a List's items failed: the List holds its limit already, or the
// server couldn't be reached.
export type ListUpdateError = "full" | "unavailable";

// Moving, noting and removing the List Items of a List page, and undoing a removal. `reload`
// reads the List afresh after each change, so the order is always the Worker's; `putBack` adds a
// removed item back where it was with its Note, and says why it couldn't.
export function useListItemEditing({
  reload,
  putBack,
}: {
  reload: () => Promise<void>;
  putBack: (item: ListItem) => Promise<ListUpdateError | null>;
}) {
  const [noting, setNoting] = useState<ListItem | null>(null);
  const [removed, setRemoved] = useState<ListItem | null>(null);
  const [error, setError] = useState<ListUpdateError | null>(null);

  async function move(item: ListItem, position: number) {
    setError(null);
    if (!(await api.editListItem(item.id, { position }))) setError("unavailable");
    await reload();
  }

  async function remove(item: ListItem) {
    setError(null);
    setRemoved(null);
    if (await api.removeListItem(item.id)) setRemoved(item);
    else setError("unavailable");
    await reload();
  }

  async function undo(item: ListItem) {
    setError(null);
    const failed = await putBack(item);
    if (failed) setError(failed);
    else setRemoved(null);
    await reload();
  }

  // Closes the Note dialog once its Note is saved, and shows the Note.
  async function noteSaved() {
    setNoting(null);
    await reload();
  }

  return { noting, setNoting, noteSaved, removed, error, move, remove, undo };
}
