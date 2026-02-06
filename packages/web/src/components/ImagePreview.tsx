'use client';

interface ImagePreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

export function ImagePreview({ files, onRemove }: ImagePreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto">
      {files.map((file, i) => (
        <div key={`${file.name}-${i}`} className="relative flex-shrink-0 group">
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
          />
          <button
            onClick={() => onRemove(i)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Remove ${file.name}`}
          >
            x
          </button>
          <span className="block text-[9px] text-gray-400 truncate w-16 mt-0.5 text-center">
            {file.name}
          </span>
        </div>
      ))}
    </div>
  );
}
