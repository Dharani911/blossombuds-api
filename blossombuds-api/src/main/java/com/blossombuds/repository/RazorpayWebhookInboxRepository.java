package com.blossombuds.repository;

import com.blossombuds.domain.RazorpayWebhookInbox;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RazorpayWebhookInboxRepository extends JpaRepository<RazorpayWebhookInbox, Long> {

    List<RazorpayWebhookInbox> findTop50ByStatusOrderByIdAsc(String status);
}