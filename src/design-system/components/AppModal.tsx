"use client";

import { Modal, type ModalProps } from "antd";

export function AppModal(props: ModalProps) {
  return <Modal centered destroyOnHidden footer={null} {...props} />;
}
