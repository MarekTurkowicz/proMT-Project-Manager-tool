import {
  useForm,
  type FieldErrors,
  type Path,
  type Resolver,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FundingCreate, FundingType } from "../../types/funding";
import "./AddFundingModal.css";

const emptyToNull = (v?: string | null) =>
  v == null || v.trim() === "" ? null : v;

// Uwaga: serializer już zwraca `type`, więc wystawiamy go w formularzu:
const FundingCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),

    program: z.string().optional(),
    funder: z.string().optional(),

    amount_total: z
      .string()
      .optional()
      .refine(
        (v) => v === undefined || v === "" || /^\d+(?:[.,]\d{1,2})?$/.test(v),
        "Amount must be a number with up to 2 decimals"
      ),
    currency: z
      .string()
      .optional()
      .refine((v) => !v || v.length === 3, "Currency must be a 3-letter code"),

    start_date: z.string().optional(),
    end_date: z.string().optional(),

    agreement_number: z.string().optional(),
    reporting_deadline: z.string().optional(),

    description: z.string().optional(),

    type: z.enum(["grant", "sponsorship", "donation", "internal"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.start_date > data.end_date) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "End date cannot be before start date",
      });
    }
  });

type FormValues = z.infer<typeof FundingCreateSchema>;

export interface AddFundingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: FundingCreate) => Promise<void> | void;
  /** opcjonalnie możesz podać domyślny typ */
  defaultType?: FundingType;
}

export default function AddFundingModal({
  open,
  onClose,
  onSubmit,
  defaultType,
}: AddFundingModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(FundingCreateSchema) as Resolver<FormValues>,
    mode: "onChange",
    defaultValues: {
      name: "",
      program: "",
      funder: "",
      amount_total: "",
      currency: "PLN",
      start_date: "",
      end_date: "",
      agreement_number: "",
      reporting_deadline: "",
      description: "",
      type: defaultType,
    },
  });

  const closeAndReset = () => {
    reset();
    onClose();
  };

  const submit = async (values: FormValues) => {
    const payload: FundingCreate = {
      name: values.name.trim(),
      program: emptyToNull(values.program),
      funder: emptyToNull(values.funder),
      amount_total: values.amount_total ? values.amount_total : null,
      currency: values.currency || "PLN",
      start_date: emptyToNull(values.start_date),
      end_date: emptyToNull(values.end_date),
      agreement_number: emptyToNull(values.agreement_number),
      reporting_deadline: emptyToNull(values.reporting_deadline),
      description: emptyToNull(values.description),
      type: values.type,
    };
    await onSubmit(payload);
    closeAndReset();
  };

  const onInvalid = (errs: FieldErrors<FormValues>) => {
    const order: Path<FormValues>[] = [
      "name",
      "start_date",
      "end_date",
      "amount_total",
      "currency",
      "agreement_number",
      "reporting_deadline",
      "type",
    ];
    const first = order.find((k) => errs[k]);
    if (first) setFocus(first);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={closeAndReset}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add funding</h2>
          <button
            className="icon-btn"
            onClick={closeAndReset}
            aria-label="Close"
          >
            x
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit(submit, onInvalid)}>
          <div className="modal-body">
            {/* Name */}
            <div>
              <label className="form-label">Name</label>
              <input
                className={`form-input ${errors.name ? "input-invalid" : ""}`}
                aria-invalid={!!errors.name}
                {...register("name")}
                placeholder="e.g. NCBR Grant 1/2025"
              />
              {errors.name && (
                <p className="error-text">{String(errors.name.message)}</p>
              )}
            </div>

            {/* Top row: Program / Funder */}
            <div className="form-grid">
              <div>
                <label className="form-label">Program</label>
                <input className="form-input" {...register("program")} />
              </div>
              <div>
                <label className="form-label">Funder</label>
                <input className="form-input" {...register("funder")} />
              </div>
            </div>

            {/* Amount / Currency */}
            <div className="form-grid">
              <div>
                <label className="form-label">Amount</label>
                <input
                  className={`form-input ${
                    errors.amount_total ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.amount_total}
                  {...register("amount_total")}
                  inputMode="decimal"
                  placeholder="250000.00"
                />
                {errors.amount_total && (
                  <p className="error-text">
                    {String(errors.amount_total.message)}
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">Currency</label>
                <input
                  className={`form-input ${
                    errors.currency ? "input-invalid" : ""
                  }`}
                  aria-invalid={!!errors.currency}
                  {...register("currency")}
                  maxLength={3}
                  placeholder="PLN"
                />
                {errors.currency && (
                  <p className="error-text">
                    {String(errors.currency.message)}
                  </p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="form-grid">
              <div>
                <label className="form-label">Start date</label>
                <input
                  type="date"
                  className="form-input"
                  {...register("start_date")}
                />
              </div>
              <div>
                <label className="form-label">End date</label>
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
            </div>

            {/* Agreement / Reporting */}
            <div className="form-grid">
              <div>
                <label className="form-label">Agreement number</label>
                <input
                  className="form-input"
                  {...register("agreement_number")}
                />
              </div>
              <div>
                <label className="form-label">Reporting deadline</label>
                <input
                  type="date"
                  className="form-input"
                  {...register("reporting_deadline")}
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="form-label">Type</label>
              <select className="form-select" {...register("type")}>
                <option value="">Select…</option>
                <option value="grant">Grant</option>
                <option value="sponsorship">Sponsorship</option>
                <option value="donation">Donation</option>
                <option value="internal">Internal</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                {...register("description")}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={closeAndReset}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!isValid || isSubmitting}
              title={!isValid ? "Fix validation errors first" : ""}
            >
              {isSubmitting ? "Saving…" : "Add funding"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
