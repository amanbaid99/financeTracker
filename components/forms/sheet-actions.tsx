import { Button } from "@/components/ui/button";
/** Stays inside the keyboard-aware sheet viewport as its fields scroll. */
export function SheetActions({pending,disabled,onCancel,label="Save",onSave}:{pending:boolean;disabled?:boolean;onCancel:()=>void;label?:string;onSave?:()=>void}) {
  return <div className="sticky bottom-0 z-10 -mx-5 flex gap-2 border-t bg-card px-5 py-3">
    <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
    <Button type={onSave?"button":"submit"} className="flex-1" disabled={pending||disabled} onClick={onSave}>{pending?"Saving…":label}</Button>
  </div>;
}
