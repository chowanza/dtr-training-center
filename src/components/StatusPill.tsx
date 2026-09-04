import { CERT_STATUS_LABEL, CERT_STATUS_PILL, type CertStatus } from "@/lib/constants";

export function StatusPill({ status }: { status: CertStatus }) {
  return <span className={`pill ${CERT_STATUS_PILL[status]}`}>{CERT_STATUS_LABEL[status]}</span>;
}
