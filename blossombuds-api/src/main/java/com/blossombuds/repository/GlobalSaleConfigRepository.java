package com.blossombuds.repository;

import com.blossombuds.domain.GlobalSaleConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** Repository for global sale/discount configuration rows. */
public interface GlobalSaleConfigRepository extends JpaRepository<GlobalSaleConfig, Long> {

    /**
     * Finds the "effective" sale config for the given time.
     * Rules:
     * - enabled = true
     * - startsAt is null OR startsAt <= now
     * - endsAt is null OR endsAt >= now
     * - if multiple match, pick the most recently created (highest createdAt; tie-breaker highest id)
     */
    @Query("""
        select g
        from GlobalSaleConfig g
        where g.enabled = true
          and (g.startsAt is null or g.startsAt <= :now)
          and (g.endsAt is null or g.endsAt >= :now)
        order by g.createdAt desc nulls last, g.id desc
    """)
    List<GlobalSaleConfig> findEffectiveConfigs(@Param("now") LocalDateTime now);

    @Query("""
    select count(g)
    from GlobalSaleConfig g
    where g.enabled = true
      and (:excludeId is null or g.id <> :excludeId)
      and (
            coalesce(g.startsAt, :minTime) <= coalesce(:endsAt, :maxTime)
        and coalesce(:startsAt, :minTime) <= coalesce(g.endsAt, :maxTime)
      )
""")
    long countOverlappingEnabled(
            @Param("startsAt") LocalDateTime startsAt,
            @Param("endsAt") LocalDateTime endsAt,
            @Param("excludeId") Long excludeId,
            @Param("minTime") LocalDateTime minTime,
            @Param("maxTime") LocalDateTime maxTime
    );


    /** Convenience method: returns only the single best effective config, if any. */
    default Optional<GlobalSaleConfig> findEffectiveConfig(LocalDateTime now) {
        List<GlobalSaleConfig> list = findEffectiveConfigs(now);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    /** Lists enabled configs (not necessarily in-window). */
    List<GlobalSaleConfig> findByEnabledTrueOrderByCreatedAtDesc();

    /** Lists all configs newest first (useful for admin UI). */
    List<GlobalSaleConfig> findAllByOrderByCreatedAtDesc();
}
