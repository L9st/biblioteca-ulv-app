import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export const inputClassName = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-ulv-blue focus:ring-2 focus:ring-ulv-blue/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
export const labelClassName = "mb-1 block text-sm font-medium text-slate-700";
export const helpTextClassName = "mt-1 text-xs text-slate-500";
export const errorTextClassName = "mt-1 text-xs font-medium text-red-600";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return <input className={`${inputClassName} ${className}`} {...props} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return <textarea className={`${inputClassName} ${className}`} {...props} />;
}
