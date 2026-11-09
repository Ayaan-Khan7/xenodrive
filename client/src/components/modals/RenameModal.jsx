import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Edit2Icon } from "lucide-react";

export function RenameModal({ isOpen, onClose, item, onRename, isLoading }) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (item) setName(item.name || "");
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== item?.name) {
      onRename(item, name.trim());
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rename">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="New Name"
          icon={Edit2Icon}
          placeholder="Enter new name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={!name.trim()}
          >
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

