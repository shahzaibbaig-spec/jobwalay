export function Field({ label, name, type = 'text', required = true, ...props }: { label:string;name:string } & Omit<React.ComponentProps<'input'>,'name'>) {
  return <label className="block space-y-2"><span className="text-sm font-semibold">{label}</span><input className="field" name={name} type={type} required={required} autoComplete={name === 'email' ? 'email' : name === 'password' ? 'new-password' : undefined} {...props} /></label>;
}
