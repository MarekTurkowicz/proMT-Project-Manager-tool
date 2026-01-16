import { useEffect, useMemo, useState } from "react";
import {
  useForm,
  type FieldErrors,
  type Path,
  type Resolver,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FundingCreate, FundingType } from "../../types/funding";
import "./FundingModal.css";

export type Funding = {
  id: number;
  name?: string | null;
  program?: string | null;
  funder?: string | null;
  amount_total?: string | null;
  currency?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  reporting_deadline?: string | null;
  agreement_number?: string | null;
  description?: string | null;
  type?: FundingType | null;
};

const emptyToNull = (v?: string | null) =>
  v == null || v.trim() === "" ? null : v;

const FundingEditSchema = z
  .object({
    name: z.string().trim().min(2, "Nazwa musi mieć min. 2 znaki"),
    program: z.string().optional(),
    funder: z.string().optional(),

    amount_total: z
      .string()
      .optional()
      .refine(
        (v) => v === undefined || v === "" || /^\d+(?:[.,]\d{1,2})?$/.test(v),
        "Kwota musi być liczbą (max 2 miejsca po przecinku)"
      ),
    currency: z
      .string()
      .optional()
      .refine((v) => !v || v.length === 3, "Waluta musi mieć 3 znaki"),

    start_date: z.string().optional(),
    end_date: z.string().optional(),
    reporting_deadline: z.string().optional(),

    agreement_number: z.string().optional(),
    description: z.string().optional(),

    type: z.enum(["grant", "sponsorship", "donation", "internal"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.start_date > data.end_date) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "Data końcowa nie może być wcześniejsza niż start",
      });
    }
  });

type FormValues = z.infer<typeof FundingEditSchema>;

export interface EditFundingModalProps {
  open: boolean;
  funding: Funding | null;
  onClose: () => void;
  onSubmit: (id: number, patch: Partial<FundingCreate>) => Promise<void> | void;
}

export default function EditFundingModal({
  open,
  funding,
  onClose,
  onSubmit,
}: EditFundingModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(FundingEditSchema) as Resolver<FormValues>,
    mode: "onChange",
    defaultValues: {
      name: "",
      program: "",
      funder: "",
      amount_total: "",
      currency: "PLN",
      start_date: "",
      end_date: "",
      reporting_deadline: "",
      agreement_number: "",
      description: "",
      type: undefined,
    },
  });

  const [generalOpen, setGeneralOpen] = useState(true);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGeneralOpen(true);
    setBudgetOpen(false);
    setDatesOpen(false);
    setDetailsOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !funding) return;

    reset({
      name: funding.name ?? "",
      program: funding.program ?? "",
      funder: funding.funder ?? "",
      amount_total: funding.amount_total ?? "",
      currency: funding.currency ?? "PLN",
      start_date: funding.start_date ?? "",
      end_date: funding.end_date ?? "",
      reporting_deadline: funding.reporting_deadline ?? "",
      agreement_number: funding.agreement_number ?? "",
      description: funding.description ?? "",
      type: (funding.type as FundingType) ?? undefined,
    });
  }, [open, funding, reset]);

  const closeAndReset = () => {
    reset();
    onClose();
  };

  const submit = async (values: FormValues) => {
    if (!funding) return;

    const patch: Partial<FundingCreate> = {
      name: values.name.trim(),
      program: emptyToNull(values.program),
      funder: emptyToNull(values.funder),
      amount_total: values.amount_total ? values.amount_total : null,
      currency: values.currency || "PLN",
      start_date: emptyToNull(values.start_date),
      end_date: emptyToNull(values.end_date),
      reporting_deadline: emptyToNull(values.reporting_deadline),
      agreement_number: emptyToNull(values.agreement_number),
      description: emptyToNull(values.description),
      type: values.type,
    };

    await onSubmit(funding.id, patch);
    closeAndReset();
  };

  const onInvalid = (errs: FieldErrors<FormValues>) => {
    const order: Path<FormValues>[] = [
      "name",
      "type",
      "amount_total",
      "currency",
      "start_date",
      "end_date",
      "reporting_deadline",
      "agreement_number",
    ];
    const first = order.find((k) => errs[k]);
    if (first) setFocus(first);
  };

  const hasDetails = useMemo(() => {
    const d = watch("description");
    const a = watch("agreement_number");
    return !!(d?.trim() || a?.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch("description"), watch("agreement_number")]);

  if (!open || !funding) return null;

  return (
    <div className="modal-overlay funding-modal" onClick={closeAndReset}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-head-left">
            <h2 className="modal-title">Edytuj finansowanie</h2>
            <div className="modal-subtitle">Zmień dane i zapisz</div>
          </div>
          <button
            className="icon-btn"
            onClick={closeAndReset}
            type="button"
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit(submit, onInvalid)}>
          <div className="modal-body">
            {/* OGÓLNE */}
            <div className="accordion">
              <button
                type="button"
                className="acc-trigger"
                onClick={() => setGeneralOpen((s) => !s)}
              >
                <span className="acc-left">
                  <span className="acc-title">Ogólne</span>
                </span>
                <span className="acc-right" aria-hidden>
                  {generalOpen ? "−" : "+"}
                </span>
              </button>

              {generalOpen && (
                <div className="acc-body">
                  <div className="field">
                    <label className="form-label">Nazwa</label>
                    <input
                      className={`form-input ${
                        errors.name ? "input-invalid" : ""
                      }`}
                      aria-invalid={!!errors.name}
                      {...register("name")}
                    />
                    {errors.name && (
                      <p className="error-text">
                        {String(errors.name.message)}
                      </p>
                    )}
                  </div>

                  <div className="grid-2 mt-10">
                    <div className="field">
                      <label className="form-label">Program</label>
                      <input className="form-input" {...register("program")} />
                    </div>
                    <div className="field">
                      <label className="form-label">Finansujący</label>
                      <input className="form-input" {...register("funder")} />
                    </div>
                  </div>

                  <div className="field mt-10">
                    <label className="form-label">Typ</label>
                    <select className="form-select" {...register("type")}>
                      <option value="">Wybierz…</option>
                      <option value="grant">Grant</option>
                      <option value="sponsorship">Sponsorowanie</option>
                      <option value="donation">Darowizna</option>
                      <option value="internal">Wewnętrzne</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* BUDŻET */}
            <div className="accordion">
              <button
                type="button"
                className="acc-trigger"
                onClick={() => setBudgetOpen((s) => !s)}
              >
                <span className="acc-left">
                  <span className="acc-title">Budżet</span>
                </span>
                <span className="acc-right" aria-hidden>
                  {budgetOpen ? "−" : "+"}
                </span>
              </button>

              {budgetOpen && (
                <div className="acc-body">
                  <div className="grid-3">
                    <div className="field">
                      <label className="form-label">Kwota</label>
                      <input
                        className={`form-input ${
                          errors.amount_total ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.amount_total}
                        {...register("amount_total")}
                        inputMode="decimal"
                      />
                      {errors.amount_total && (
                        <p className="error-text">
                          {String(errors.amount_total.message)}
                        </p>
                      )}
                    </div>

                    <div className="field">
                      <label className="form-label">Waluta</label>
                      <input
                        className={`form-input ${
                          errors.currency ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.currency}
                        {...register("currency")}
                        maxLength={3}
                      />
                      {errors.currency && (
                        <p className="error-text">
                          {String(errors.currency.message)}
                        </p>
                      )}
                    </div>

                    <div className="callout">
                      <b>Tip:</b> kropka lub przecinek.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DATY  */}
            <div className="accordion">
              <button
                type="button"
                className="acc-trigger"
                onClick={() => setDatesOpen((s) => !s)}
              >
                <span className="acc-left">
                  <span className="acc-title">Daty</span>
                </span>
                <span className="acc-right" aria-hidden>
                  {datesOpen ? "−" : "+"}
                </span>
              </button>

              {datesOpen && (
                <div className="acc-body">
                  <div className="grid-3">
                    <div className="field">
                      <label className="form-label">Start</label>
                      <input
                        type="date"
                        className="form-input"
                        {...register("start_date")}
                      />
                    </div>

                    <div className="field">
                      <label className="form-label">Koniec</label>
                      <input
                        type="date"
                        className={`form-input ${
                          errors.end_date ? "input-invalid" : ""
                        }`}
                        aria-invalid={!!errors.end_date}
                        {...register("end_date")}
                      />
                      {errors.end_date && (
                        <p className="error-text">
                          {String(errors.end_date.message)}
                        </p>
                      )}
                    </div>

                    <div className="field">
                      <label className="form-label">Termin raportu</label>
                      <input
                        type="date"
                        className="form-input"
                        {...register("reporting_deadline")}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SZCZEGÓŁY */}
            <div className="accordion">
              <button
                type="button"
                className="acc-trigger"
                onClick={() => setDetailsOpen((s) => !s)}
              >
                <span className="acc-left">
                  <span className="acc-title">Szczegóły</span>
                  {hasDetails && <span className="acc-dot" aria-hidden />}
                </span>
                <span className="acc-right" aria-hidden>
                  {detailsOpen ? "−" : "+"}
                </span>
              </button>

              {detailsOpen && (
                <div className="acc-body">
                  <div className="grid-2">
                    <div className="field">
                      <label className="form-label">Nr umowy</label>
                      <input
                        className="form-input"
                        {...register("agreement_number")}
                      />
                    </div>
                    <div className="callout">
                      <b>Info:</b> jeśli brak — zostaw puste.
                    </div>
                  </div>

                  <div className="field mt-10">
                    <label className="form-label">Opis</label>
                    <textarea
                      className="form-textarea textarea-compact"
                      rows={2}
                      {...register("description")}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={closeAndReset}
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? "Zapisywanie…" : "Zapisz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
