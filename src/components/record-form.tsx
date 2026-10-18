"use client";
import { useState, type FormEvent } from "react";
import { Check, LoaderCircle } from "lucide-react";
import type { MessageKey } from "@/messages";
import type { Editor } from "./view-types";

export function RecordForm({
  editor,
  busy,
  error,
  tr,
  onCancel,
  onSubmit,
}: {
  editor: Editor;
  busy: boolean;
  error: string;
  tr: (key: MessageKey) => string;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [localError, setLocalError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError("");
    const form = new FormData(e.currentTarget);
    const number = (key: string) => Number(form.get(key));
    const integer = (n: number) => Number.isInteger(n) && n >= 0;
    let body: Record<string, unknown> = {};
    if (editor.kind === "inventory") {
      const quantity = number("quantity");
      const reason = String(form.get("reason") ?? "").trim();
      if (
        !integer(quantity) ||
        quantity < editor.record.reserved ||
        reason.length < 5
      ) {
        setLocalError(tr("validationError"));
        return;
      }
      body = { quantity, version: editor.record.version, reason };
    } else if (editor.kind === "beds") {
      const beds = number("beds"),
        occupied = number("occupied");
      if (!integer(beds) || !integer(occupied) || occupied > beds) {
        setLocalError(tr("bedHelp"));
        return;
      }
      body = { facilityId: editor.facility.id, beds, occupied };
    } else if (editor.kind === "doctors") {
      const presentDoctors = number("presentDoctors");
      if (
        !integer(presentDoctors) ||
        presentDoctors > editor.facility.scheduledDoctors
      ) {
        setLocalError(tr("doctorHelp"));
        return;
      }
      body = {
        facilityId: editor.facility.id,
        presentDoctors,
        attendanceRecorded: form.get("attendanceRecorded") === "on",
      };
    } else if (editor.kind === "flow") {
      const patientsToday = number("patientsToday");
      if (!integer(patientsToday)) {
        setLocalError(tr("validationError"));
        return;
      }
      body = { facilityId: editor.facility.id, patientsToday };
    } else if (editor.kind === "diagnostics") {
      body = {
        facilityId: editor.record.facilityId,
        diagnosticId: editor.record.id,
        equipment: form.get("equipment"),
        reagents: form.get("reagents") === "on",
      };
    }
    await onSubmit(body);
  }
  return (
    <form className="drawer-body record-form" onSubmit={submit}>
      <p className="form-intro">
        {tr(editor.kind === "inventory" ? "stockHelp" : "operationsHelp")}
      </p>
      {editor.kind === "inventory" && (
        <>
          <label>
            {tr("quantityLabel")}
            <input
              name="quantity"
              type="number"
              min={editor.record.reserved}
              max={10000000}
              step="1"
              defaultValue={editor.record.quantity}
              required
            />
          </label>
          <span className="form-hint">
            {tr("reserved")}: {editor.record.reserved} · {tr("version")}:{" "}
            {editor.record.version}
          </span>
          <label>
            {tr("reasonLabel")}
            <textarea
              name="reason"
              minLength={5}
              maxLength={400}
              rows={3}
              required
            />
          </label>
        </>
      )}
      {editor.kind === "beds" && (
        <>
          <label>
            {tr("bedsTotal")}
            <input
              name="beds"
              type="number"
              min="0"
              max="10000"
              step="1"
              defaultValue={editor.facility.beds}
              required
            />
          </label>
          <label>
            {tr("occupied")}
            <input
              name="occupied"
              type="number"
              min="0"
              max="10000"
              step="1"
              defaultValue={editor.facility.occupied}
              required
            />
          </label>
          <span className="form-hint">{tr("bedHelp")}</span>
        </>
      )}
      {editor.kind === "doctors" && (
        <>
          <div className="drawer-note">
            {tr("scheduled")}: {editor.facility.scheduledDoctors}
          </div>
          <label>
            {tr("present")}
            <input
              name="presentDoctors"
              type="number"
              min="0"
              max={editor.facility.scheduledDoctors}
              step="1"
              defaultValue={editor.facility.presentDoctors}
              required
            />
          </label>
          <label className="checkbox-label">
            <input
              name="attendanceRecorded"
              type="checkbox"
              defaultChecked={editor.facility.attendanceRecorded}
            />
            {tr("attendance")}
          </label>
        </>
      )}
      {editor.kind === "flow" && (
        <label>
          {tr("patientCount")}
          <input
            name="patientsToday"
            type="number"
            min="0"
            max="100000"
            step="1"
            defaultValue={editor.facility.patientsToday}
            required
          />
        </label>
      )}
      {editor.kind === "diagnostics" && (
        <>
          <label>
            {tr("equipment")}
            <select name="equipment" defaultValue={editor.record.equipment}>
              <option value="operational">{tr("operational")}</option>
              <option value="down">{tr("down")}</option>
              <option value="unknown">{tr("unknown")}</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              name="reagents"
              type="checkbox"
              defaultChecked={editor.record.reagents}
            />
            {tr("reagents")} — {tr("yes")}
          </label>
        </>
      )}
      {(localError || error) && (
        <p className="form-error" role="alert">
          {localError || error}
        </p>
      )}
      <div className="form-actions">
        <button className="button secondary" type="button" onClick={onCancel}>
          {tr("cancel")}
        </button>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}{" "}
          {tr(busy ? "saving" : "save")}
        </button>
      </div>
    </form>
  );
}
