package com.blossombuds.web;

import com.blossombuds.dto.WhatsAppDtos;
import com.blossombuds.service.WhatsAppCampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Admin APIs for managing WhatsApp templates, campaigns, and recipients. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/whatsapp")
public class AdminWhatsAppController {

    private final WhatsAppCampaignService whatsAppCampaignService;

    /** Lists active WhatsApp templates available for campaign creation. */
    @GetMapping("/templates")
    public List<WhatsAppDtos.TemplateResponse> listTemplates() {
        return whatsAppCampaignService.listActiveTemplates()
                .stream()
                .map(whatsAppCampaignService::toTemplateResponse)
                .toList();
    }

    /** Lists WhatsApp campaigns ordered by latest first. */
    @GetMapping("/campaigns")
    public List<WhatsAppDtos.CampaignResponse> listCampaigns() {
        return whatsAppCampaignService.listCampaigns()
                .stream()
                .map(whatsAppCampaignService::toCampaignResponse)
                .toList();
    }

    /** Creates a new WhatsApp campaign and prepares recipients. */
    @PostMapping("/campaigns")
    public WhatsAppDtos.CampaignResponse createCampaign(
            @RequestBody WhatsAppCampaignService.CreateCampaignRequest request
    ) {
        return whatsAppCampaignService.toCampaignResponse(
                whatsAppCampaignService.createCampaign(request)
        );
    }

    /** Sends all pending recipients for a campaign. */
    @PostMapping("/campaigns/{campaignId}/send")
    public WhatsAppDtos.CampaignResponse sendCampaign(@PathVariable Long campaignId) {
        return whatsAppCampaignService.toCampaignResponse(
                whatsAppCampaignService.sendCampaign(campaignId)
        );
    }

    /** Lists recipients for a campaign. */
    @GetMapping("/campaigns/{campaignId}/recipients")
    public List<WhatsAppDtos.RecipientResponse> listRecipients(@PathVariable Long campaignId) {
        return whatsAppCampaignService.listRecipients(campaignId)
                .stream()
                .map(whatsAppCampaignService::toRecipientResponse)
                .toList();
    }
}