'use client';

interface DatePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    className?: string;
    required?: boolean;
}

export function DatePicker({ date, setDate, className = '', required = false }: DatePickerProps) {
    // Date object to YYYY-MM-DD string
    const value = date ? date.toLocaleDateString('sv-SE') : ''; // sv-SE is YYYY-MM-DD

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val) {
            // "YYYY-MM-DD" -> Date (Local)
            const [y, m, d] = val.split('-').map(Number);
            setDate(new Date(y, m - 1, d));
        } else {
            setDate(undefined);
        }
    };

    return (
        <input
            type="date"
            required={required}
            value={value}
            onChange={handleChange}
            className={`w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-radiko-blue ${className}`}
        />
    );
}
