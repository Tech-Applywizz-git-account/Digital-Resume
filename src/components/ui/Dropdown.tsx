// // src/components/ui/Dropdown.tsx
// import React from 'react';

// interface DropdownProps {
//   options: string[];
//   selected: string | null;
//   setSelected: (value: string) => void;
// }

// export const Dropdown: React.FC<DropdownProps> = ({ options, selected, setSelected }) => {
//   return (
//     <div className="w-full">
//       <select
//         value={selected || ""}
//         onChange={(e) => setSelected(e.target.value)}
//         className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
//       >
//         <option value="" disabled>
//           Select your networking goal
//         </option>
//         {options.map((option, index) => (
//           <option key={index} value={option}>
//             {option}
//           </option>
//         ))}
//       </select>
//     </div>
//   );
// };



// src/components/ui/Dropdown.tsx
import React from 'react';

interface DropdownProps {
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;  // Change 'setSelected' to 'onSelect'
}

export const Dropdown: React.FC<DropdownProps> = ({ options, selected, onSelect }) => {
  return (
    <div className="w-full">
      <select
        value={selected || ""}
        onChange={(e) => onSelect(e.target.value)}  // Use onSelect here
        className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="" disabled>
          Select your networking goal
        </option>
        {options.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};
